
import type { ReactNode } from "react";

interface ReportTableProps {
  children: ReactNode;
  className?: string;
}

export function ReportTable({
  children,
  className = "",
}: ReportTableProps) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      {children}
    </div>
  );
}
