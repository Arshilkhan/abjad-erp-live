
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
import { ReportDateRange } from "./shared/ReportDateRange";
import { ReportTable } from "./shared/ReportTable";
import { downloadCSV } from "./shared/report-utils";

interface ReportDateProps {
    from: string;
    to: string;
    onFrom: (value: string) => void;
    onTo: (value: string) => void;
}

export function ImportsReport({
    from,
    to,
    onFrom,
    onTo,
}: ReportDateProps) {

    const { data: rows = [] } = useQuery({
        queryKey: ["rep-imports", from, to],
        queryFn: async () =>
            (await supabase
                .from("invoices")
                .select(
                    "invoice_number, invoice_date, customer_name_snapshot, grand_total, status, import_source",
                )
                .eq("is_imported", true)
                .gte("invoice_date", from)
                .lte("invoice_date", to)
                .order("invoice_date", { ascending: false })).data ?? [],
    });

    const sortedRows = sortByInvoiceNumber(rows);

    const total = (rows as any[]).reduce(
        (sum: number, row: any) =>
            sum + Number(row.grand_total),
        0,
    );

    return (
        <ReportCard
            title={`Imported Invoices • ${formatINR(total)}`}
            actions={
                <>
                    <ReportDateRange
                        from={from}
                        to={to}
                        onFrom={onFrom}
                        onTo={onTo}
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            downloadCSV(
                                `imports-${from}-${to}.csv`,
                                sortedRows as any[],
                            )
                        }
                    >
                        <Download className="mr-1 h-4 w-4" />
                        CSV
                    </Button>
                </>
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
                            <TableHead>Status</TableHead>
                            <TableHead>Source</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    No imported invoices in range.
                                </TableCell>
                            </TableRow>
                        )}

                        {(sortedRows as any[]).map((row: any, index: number) => (
                            <TableRow key={index}>
                                <TableCell className="font-mono text-xs">
                                    {billNo(row.invoice_number)}
                                </TableCell>
                                <TableCell>{formatDate(row.invoice_date)}</TableCell>
                                <TableCell>{row.customer_name_snapshot}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.grand_total)}
                                </TableCell>
                                <TableCell className="uppercase text-xs">
                                    {row.status}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                    {row.import_source ?? "—"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ReportTable>
        </ReportCard>
    );
}
