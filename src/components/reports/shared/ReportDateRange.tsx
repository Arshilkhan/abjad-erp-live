
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ReportDateRangeProps {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}

export function ReportDateRange({
  from,
  to,
  onFrom,
  onTo,
}: ReportDateRangeProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          value={from}
          onChange={(event) => onFrom(event.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          value={to}
          onChange={(event) => onTo(event.target.value)}
          className="w-40"
        />
      </div>
    </div>
  );
}
