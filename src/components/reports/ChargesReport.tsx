
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

function Metric({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-md border p-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
            </div>
            <div className="font-semibold tabular-nums">
                {value}
            </div>
        </div>
    );
}

interface ReportDateProps {
    from: string;
    to: string;
    onFrom: (value: string) => void;
    onTo: (value: string) => void;
}

export function ChargesReport({
    from,
    to,
    onFrom,
    onTo,
}: ReportDateProps) {

    const { data: rows = [] } = useQuery({
        queryKey: ["rep-charges", from, to],
        queryFn: async () =>
            (await supabase
                .from("invoices")
                .select(
                    "invoice_number, invoice_date, customer_name_snapshot, freight, packing_charges, transportation_charges, delivery_charges, other_charges",
                )
                .gte("invoice_date", from)
                .lte("invoice_date", to)
                .order("invoice_date")).data ?? [],
    });

    const sortedRows = sortByInvoiceNumber(rows);

    const totals = (rows as any[]).reduce(
        (acc: any, row: any) => ({
            freight: acc.freight + Number(row.freight ?? 0),
            packing:
                acc.packing + Number(row.packing_charges ?? 0),
            transport:
                acc.transport +
                Number(row.transportation_charges ?? 0),
            delivery:
                acc.delivery + Number(row.delivery_charges ?? 0),
            other: acc.other + Number(row.other_charges ?? 0),
        }),
        {
            freight: 0,
            packing: 0,
            transport: 0,
            delivery: 0,
            other: 0,
        },
    );

    return (
        <ReportCard
            title="Charges Breakdown"
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
                                `charges-${from}-${to}.csv`,
                                sortedRows as any[],
                            )
                        }
                    >
                        <Download className="mr-1 h-4 w-4" />
                        CSV
                    </Button>
                </>
            }
            contentClassName="space-y-3 p-0"
        >
            <div className="grid grid-cols-2 gap-2 px-5 pt-4 text-sm sm:grid-cols-5">
                <Metric label="Freight" value={formatINR(totals.freight)} />
                <Metric label="Packing" value={formatINR(totals.packing)} />
                <Metric
                    label="Transportation"
                    value={formatINR(totals.transport)}
                />
                <Metric label="Delivery" value={formatINR(totals.delivery)} />
                <Metric label="Other" value={formatINR(totals.other)} />
            </div>

            <ReportTable>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Freight</TableHead>
                            <TableHead className="text-right">Packing</TableHead>
                            <TableHead className="text-right">Transport</TableHead>
                            <TableHead className="text-right">Delivery</TableHead>
                            <TableHead className="text-right">Other</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={8}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    No charges in range.
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
                                    {formatINR(row.freight)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.packing_charges)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.transportation_charges)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.delivery_charges)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {formatINR(row.other_charges)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ReportTable>
        </ReportCard>
    );
}
