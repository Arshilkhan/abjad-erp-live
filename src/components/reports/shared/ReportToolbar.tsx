
import type { ReactNode } from "react";
import { ReportDateRange } from "./ReportDateRange";

interface ReportToolbarProps {
  from?: string;
  to?: string;
  onFrom?: (value: string) => void;
  onTo?: (value: string) => void;
  actions?: ReactNode;
}

export function ReportToolbar({
  from,
  to,
  onFrom,
  onTo,
  actions,
}: ReportToolbarProps) {
  const hasDateRange =
    from !== undefined &&
    to !== undefined &&
    onFrom !== undefined &&
    onTo !== undefined;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      {hasDateRange && (
        <ReportDateRange
          from={from}
          to={to}
          onFrom={onFrom}
          onTo={onTo}
        />
      )}

      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
