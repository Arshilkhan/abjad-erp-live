
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

export function RejectedReport({
    from,
    to,
    onFrom,
    onTo,
}: ReportDateProps) {

    const { data: rows = [] } = useQuery({
        queryKey: ["rep-rejected", from, to],
        queryFn: async () =>
            (await (supabase.from("invoice_rejections") as any)
                .select(
                    "*, invoices(invoice_number, customer_name_snapshot), invoice_items(description)",
                )
                .gte("created_at", from)
                .lte("created_at", `${to}T23:59:59`)
                .order("created_at", { ascending: false })).data ?? [],
    });

    const flat = (rows as any[]).map((row: any) => ({
        date: formatDate(row.created_at),
        invoice: billNo(row.invoices?.invoice_number),
        customer: row.invoices?.customer_name_snapshot,
        item: row.invoice_items?.description,
        quantity: row.rejected_quantity,
        reason: row.rejection_reason,
        rejected_value: row.rejected_value,
        gst_deduction: row.gst_deduction,
        total_deduction: row.total_deduction,
    }));

    const total = flat.reduce(
        (sum: number, row: any) =>
            sum + Number(row.total_deduction),
        0,
    );

    return (
        <ReportCard
            title={`Rejected Items • Deduction ${formatINR(total)}`}
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
                            downloadCSV(`rejected-${from}-${to}.csv`, flat)
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
                            <TableHead>Date</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Deduction</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {flat.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    No rejected items in range.
                                </TableCell>
                            </TableRow>
                        )}

                        {flat.map((row: any, index: number) => (
                            <TableRow key={index}>
                                <TableCell className="text-xs">
                                    {row.date}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                    {row.invoice}
                                </TableCell>
                                <TableCell>{row.customer}</TableCell>
                                <TableCell className="max-w-[220px] truncate">
                                    {row.item}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {row.quantity}
                                </TableCell>
                                <TableCell>{row.reason}</TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">
                                    {formatINR(row.total_deduction)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ReportTable>
        </ReportCard>
    );
}
