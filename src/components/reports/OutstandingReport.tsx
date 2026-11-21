
import { sortByInvoiceNumber } from "./shared/invoice-sort";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  formatINR,
  formatDate,
  billNo,
} from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ReportCard } from "./shared/ReportCard";
import { ReportTable } from "./shared/ReportTable";
import { downloadCSV, today } from "./shared/report-utils";

interface ReportDateProps {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}

export function OutstandingReport({
  from,
  to,
  onFrom,
  onTo,
}: ReportDateProps) {
  const { data: rows = [] } = useQuery({
    queryKey: ["rep-outstanding"],
    queryFn: async () =>
      (await supabase
        .from("invoices")
        .select(
          "invoice_number, invoice_date, customer_name_snapshot, grand_total, amount_paid, status",
        )
        .in("status", ["sent", "partial"])
        .order("invoice_date")).data ?? [],
  });

  const sortedRows = sortByInvoiceNumber(rows);

  const enriched = sortedRows.map((row: any) => {
    const due =
      Number(row.grand_total) - Number(row.amount_paid);

    const days = Math.max(
      0,
      Math.floor(
        (Date.now() - new Date(row.invoice_date).getTime()) /
        86400000,
      ),
    );

    return { ...row, due, days };
  });

  return (
    <ReportCard
      title="Outstanding Receivables"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCSV(`outstanding_${today()}.csv`, enriched)
          }
        >
          <Download className="mr-1 h-4 w-4" />
          CSV
        </Button>
      }
    >
      <ReportTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead className="text-right">Age</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {enriched.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-6 text-center text-muted-foreground"
                >
                  Nothing outstanding.
                </TableCell>
              </TableRow>
            )}

            {enriched.map((row: any, index: number) => (
              <TableRow key={index}>
                <TableCell className="font-mono">
                  {billNo(row.invoice_number)}
                </TableCell>
                <TableCell>{formatDate(row.invoice_date)}</TableCell>
                <TableCell>{row.customer_name_snapshot}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(row.grand_total)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(row.amount_paid)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {formatINR(row.due)}
                </TableCell>
                <TableCell
                  className={`text-right ${row.days > 30
                    ? "text-warning font-semibold"
                    : ""
                    }`}
                >
                  {row.days}d
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTable>
    </ReportCard>
  );
}
