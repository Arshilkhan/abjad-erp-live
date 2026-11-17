
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
import { downloadCSV } from "./shared/report-utils";

export function CustomerCreditsReport() {
  const { data: rows = [] } = useQuery({
    queryKey: ["rep-credits"],
    queryFn: async () =>
      (await (supabase.from("customer_credits") as any)
        .select("*, customers(name), invoices(invoice_number)")
        .order("created_at", { ascending: false })).data ?? [],
  });

  const flat = (rows as any[]).map((row: any) => ({
    date: formatDate(row.created_at),
    customer: row.customers?.name,
    invoice: billNo(row.invoices?.invoice_number),
    credit_amount: row.credit_amount,
    status: row.status,
    notes: row.notes,
  }));

  const total = flat.reduce(
    (sum: number, row: any) =>
      sum + Number(row.credit_amount),
    0,
  );

  return (
    <ReportCard
      title={`Customer Credits • ${formatINR(total)}`}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => downloadCSV("credits.csv", flat)}
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
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {flat.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-muted-foreground"
                >
                  No customer credits.
                </TableCell>
              </TableRow>
            )}

            {flat.map((row: any, index: number) => (
              <TableRow key={index}>
                <TableCell className="text-xs">
                  {row.date}
                </TableCell>
                <TableCell>{row.customer}</TableCell>
                <TableCell className="font-mono text-xs">
                  {row.invoice}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatINR(row.credit_amount)}
                </TableCell>
                <TableCell className="uppercase text-xs">
                  {row.status}
                </TableCell>
                <TableCell className="max-w-[240px] truncate text-muted-foreground">
                  {row.notes}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTable>
    </ReportCard>
  );
}
