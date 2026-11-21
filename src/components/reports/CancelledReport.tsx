
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
import { downloadCSV, startOfYear, today } from "./shared/report-utils";

interface ReportDateProps {
    from: string;
    to: string;
    onFrom: (value: string) => void;
    onTo: (value: string) => void;
}

export function CancelledReport({
    from,
    to,
    onFrom,
    onTo,
}: ReportDateProps) {

    const { data: rows = [] } = useQuery({
        queryKey: ["rep-cancelled", from, to],
        queryFn: async () =>
            (await supabase
                .from("invoices")
                .select(
                    "invoice_number, invoice_date, customer_name_snapshot, grand_total, cancelled_at, cancellation_reason",
                )
                .eq("status", "cancelled")
                .gte("invoice_date", from)
                .lte("invoice_date", to)
                .order("cancelled_at", { ascending: false })).data ?? [],
    });

    const sortedRows = sortByInvoiceNumber(rows);

    const total = rows.reduce(
        (sum: number, row: any) =>
            sum + Number(row.grand_total),
        0,
    );

    return (
        <ReportCard
            title={`Cancelled Invoices • Total ${formatINR(total)}`}
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
                                `cancelled-${from}-${to}.csv`,
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
                            <TableHead>Cancelled</TableHead>
                            <TableHead>Reason</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    No cancelled invoices in range.
                                </TableCell>
                            </TableRow>
                        )}

                        {sortedRows.map((row: any, index: number) => (
                            <TableRow key={index}>
                                <TableCell className="font-mono text-xs">
                                    {billNo(row.invoice_number)}
                                </TableCell>
                                <TableCell>{formatDate(row.invoice_date)}</TableCell>
                                <TableCell>{row.customer_name_snapshot}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.grand_total)}
                                </TableCell>
                                <TableCell>
                                    {row.cancelled_at
                                        ? formatDate(row.cancelled_at)
                                        : "—"}
                                </TableCell>
                                <TableCell className="max-w-[240px] truncate text-muted-foreground">
                                    {row.cancellation_reason ?? "—"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ReportTable>
        </ReportCard>
    );
}
