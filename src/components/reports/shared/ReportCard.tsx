
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ReportCardProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

export function ReportCard({
  title,
  actions,
  children,
  contentClassName = "p-0",
}: ReportCardProps) {
  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">{title}</CardTitle>

        {actions && (
          <div className="flex flex-wrap items-end gap-3">
            {actions}
          </div>
        )}
      </CardHeader>

      <CardContent className={contentClassName}>
        {children}
      </CardContent>
    </Card>
  );
}
