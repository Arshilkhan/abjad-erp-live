
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";

export interface TypeaheadOption {
  id: string;
  label: string;
  sublabel?: string;
}

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export function TypeaheadInput({
  value,
  onChange,
  onSelect,
  onMissing,
  options,
  placeholder,
  className,
  inputClassName,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (opt: TypeaheadOption) => void;
  onMissing?: (text: string) => void;
  options: TypeaheadOption[];
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();

    if (!query) return options;

    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        (option.sublabel ?? "").toLowerCase().includes(query),
    );
  }, [value, options]);

  const updatePosition = () => {
    const element = wrapRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const gap = 5;
    const edgePadding = 12;

    const spaceBelow = viewportHeight - rect.bottom - gap - edgePadding;
    const spaceAbove = rect.top - gap - edgePadding;

    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
    const availableSpace = Math.max(
      100,
      openAbove ? spaceAbove : spaceBelow,
    );

    const maxHeight = Math.min(320, availableSpace);

    setPosition({
      top: openAbove
        ? rect.top - gap - maxHeight
        : rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 220),
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();

    const handleScroll = (event: Event) => {
      // Scrolling inside the suggestion list must not reposition it.
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(event.target as Node)
      ) {
        return;
      }

      updatePosition();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        wrapRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const pick = (option: TypeaheadOption) => {
    onChange(option.label);
    onSelect(option);
    setOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      const text = value.trim();

      if (!text) return;

      const match = options.find(
        (option) => option.label.toLowerCase() === text.toLowerCase(),
      );

      if (!match && onMissing) {
        onMissing(text);
      }
    }, 150);
  };

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (!open) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlight((current) =>
              Math.min(current + 1, filtered.length - 1),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && filtered[highlight]) {
            event.preventDefault();
            pick(filtered[highlight]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {mounted &&
        open &&
        filtered.length > 0 &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              zIndex: 9999,
              pointerEvents: "auto",
            }}
            className="rounded-md border bg-popover text-popover-foreground shadow-lg"
          >
            {filtered.map((option, index) => (
              <div
                key={option.id}
                role="option"
                aria-selected={index === highlight}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === highlight
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                }`}
              >
                <div className="font-medium">{option.label}</div>
                {option.sublabel && (
                  <div className="text-xs text-muted-foreground">
                    {option.sublabel}
                  </div>
                )}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
