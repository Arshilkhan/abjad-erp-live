
import type { ReactNode } from "react";

interface ReportTableProps {
    children: ReactNode;
    className?: string;
    inset?: boolean;
}

export function ReportTable({
    children,
    className = "",
    inset = true,
}: ReportTableProps) {
    return (
        <div
            className={[
                "box-border min-w-0 max-w-full overflow-x-auto",
                inset
                    ? "mx-3 w-[calc(100%-1.5rem)]"
                    : "w-full",
                className,
            ].join(" ")}
        >
            {children}
        </div>
    );
}
