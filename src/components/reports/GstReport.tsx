
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

export function GstReport({
    from,
    to,
    onFrom,
    onTo,
}: ReportDateProps) {

    const { data: rows = [] } = useQuery({
        queryKey: ["rep-gst", from, to],
        queryFn: async () =>
            (await supabase
                .from("invoices")
                .select(
                    "invoice_number, invoice_date, customer_name_snapshot, customer_gst_snapshot, subtotal, sgst_amount, cgst_amount, igst_amount, grand_total, is_igst",
                )
                .eq("invoice_type", "tax_invoice")
                .gte("invoice_date", from)
                .lte("invoice_date", to)
                .order("invoice_date")).data ?? [],
    });

    const sortedRows = sortByInvoiceNumber(rows);

    const totals = rows.reduce(
        (acc, row: any) => ({
            taxable: acc.taxable + Number(row.subtotal ?? 0),
            sgst: acc.sgst + Number(row.sgst_amount ?? 0),
            cgst: acc.cgst + Number(row.cgst_amount ?? 0),
            igst: acc.igst + Number(row.igst_amount ?? 0),
        }),
        { taxable: 0, sgst: 0, cgst: 0, igst: 0 },
    );

    return (
        <ReportCard
            title="GSTR-1 Summary"
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
                            downloadCSV(`gstr1_${from}_${to}.csv`, sortedRows)
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
                            <TableHead>Customer GSTIN</TableHead>
                            <TableHead className="text-right">Taxable</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    No tax invoices in range.
                                </TableCell>
                            </TableRow>
                        )}

                        {sortedRows.map((row: any, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-mono">
                                    {billNo(row.invoice_number)}
                                </TableCell>
                                <TableCell>{formatDate(row.invoice_date)}</TableCell>
                                <TableCell className="font-mono text-xs">
                                    {row.customer_gst_snapshot ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.subtotal)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.sgst_amount)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.cgst_amount)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.igst_amount)}
                                </TableCell>
                            </TableRow>
                        ))}

                        {rows.length > 0 && (
                            <TableRow className="bg-muted/40 font-semibold">
                                <TableCell colSpan={3} className="text-right">
                                    Totals
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(totals.taxable)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(totals.sgst)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(totals.cgst)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(totals.igst)}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ReportTable>
        </ReportCard>
    );
}
