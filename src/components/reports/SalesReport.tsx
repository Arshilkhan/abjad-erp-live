
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

export function SalesReport({
    from,
    to,
    onFrom,
    onTo,
}: ReportDateProps) {

    const { data: rows = [] } = useQuery({
        queryKey: ["rep-sales", from, to],
        queryFn: async () =>
            (await supabase
                .from("invoices")
                .select(
                    "invoice_number, invoice_date, invoice_type, customer_name_snapshot, subtotal, sgst_amount, cgst_amount, igst_amount, grand_total, status",
                )
                .gte("invoice_date", from)
                .lte("invoice_date", to)
                .in("invoice_type", ["tax_invoice", "proforma"])
                .order("invoice_date")).data ?? [],
    });

    const totals = rows.reduce(
        (acc, row: any) => ({
            net: acc.net + Number(row.subtotal ?? 0),
            tax:
                acc.tax +
                Number(row.sgst_amount ?? 0) +
                Number(row.cgst_amount ?? 0) +
                Number(row.igst_amount ?? 0),
            grand: acc.grand + Number(row.grand_total ?? 0),
        }),
        { net: 0, tax: 0, grand: 0 },
    );

    return (
        <ReportCard
            title="Sales Report"
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
                            downloadCSV(`sales_${from}_${to}.csv`, rows)
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
                            <TableHead>Type</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Taxable</TableHead>
                            <TableHead className="text-right">Tax</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    No sales in range.
                                </TableCell>
                            </TableRow>
                        )}

                        {rows.map((row: any, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-mono">
                                    {billNo(row.invoice_number)}
                                </TableCell>
                                <TableCell>{formatDate(row.invoice_date)}</TableCell>
                                <TableCell className="text-xs uppercase">
                                    {row.invoice_type}
                                </TableCell>
                                <TableCell>{row.customer_name_snapshot}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.subtotal)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(
                                        Number(row.sgst_amount ?? 0) +
                                        Number(row.cgst_amount ?? 0) +
                                        Number(row.igst_amount ?? 0),
                                    )}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">
                                    {formatINR(row.grand_total)}
                                </TableCell>
                            </TableRow>
                        ))}

                        {rows.length > 0 && (
                            <TableRow className="bg-muted/40 font-semibold">
                                <TableCell colSpan={3} className="text-right">
                                    Totals
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(totals.net)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(totals.tax)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(totals.grand)}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ReportTable>
        </ReportCard>
    );
}
