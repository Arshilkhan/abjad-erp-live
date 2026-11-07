import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { formatINR, formatDate, billNo } from "@/lib/format";
import { CancelInvoiceDialog } from "@/components/cancel-invoice-dialog";
import { useAuth } from "@/lib/auth-context";

export const taxInvoiceStatusStyles: Record<string, string> = {
    paid: "bg-[color:oklch(0.92_0.06_155)] text-[color:oklch(0.35_0.14_155)] border-transparent",
    sent: "bg-secondary text-secondary-foreground",
    partial: "bg-[color:oklch(0.94_0.09_75)] text-[color:oklch(0.40_0.15_75)] border-transparent",
    draft: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive border-transparent",
};

type SortField = "invoice" | "customer" | "date" | "total";

export function TaxInvoiceTable({
    rows,
    isLoading,
}: {
    rows: any[];
    isLoading?: boolean;
}) {
    const qc = useQueryClient();
    const { canPerform } = useAuth();
    const canCancelTaxInvoice = canPerform("tax_invoice", "cancel");
    const canCreateTaxInvoice = canPerform("tax_invoice", "create");

    const [sortField, setSortField] = useState<SortField | null>(() => {
        const saved = localStorage.getItem("abjad-erp-tax-invoice-sort-field");

        return saved === "invoice" ||
            saved === "customer" ||
            saved === "date" ||
            saved === "total"
            ? saved
            : null;
    });

    const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() => {
        const saved = localStorage.getItem(
            "abjad-erp-tax-invoice-sort-direction",
        );

        return saved === "desc" ? "desc" : "asc";
    });

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            const nextDirection =
                sortDirection === "asc" ? "desc" : "asc";

            setSortDirection(nextDirection);

            localStorage.setItem(
                "abjad-erp-tax-invoice-sort-direction",
                nextDirection,
            );
        } else {
            setSortField(field);
            setSortDirection("asc");

            localStorage.setItem(
                "abjad-erp-tax-invoice-sort-field",
                field,
            );

            localStorage.setItem(
                "abjad-erp-tax-invoice-sort-direction",
                "asc",
            );
        }
    };

    const sortedRows = useMemo(() => {
        if (!sortField) return rows;

        return [...rows].sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case "invoice":
                    comparison = String(a.invoice_number ?? "").localeCompare(
                        String(b.invoice_number ?? ""),
                        undefined,
                        {
                            numeric: true,
                            sensitivity: "base",
                        },
                    );
                    break;

                case "customer":
                    comparison = String(
                        a.customer_name_snapshot ?? "",
                    ).localeCompare(
                        String(b.customer_name_snapshot ?? ""),
                        undefined,
                        { sensitivity: "base" },
                    );
                    break;

                case "date":
                    comparison =
                        new Date(a.invoice_date).getTime() -
                        new Date(b.invoice_date).getTime();
                    break;

                case "total":
                    comparison =
                        Number(a.grand_total ?? 0) -
                        Number(b.grand_total ?? 0);
                    break;
            }

            return sortDirection === "asc"
                ? comparison
                : -comparison;
        });
    }, [rows, sortField, sortDirection]);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("invoice")}
                    >
                        Invoice #
                    </TableHead>

                    <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("customer")}
                    >
                        Customer
                    </TableHead>

                    <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => handleSort("date")}
                    >
                        Date
                    </TableHead>

                    <TableHead
                        className="cursor-pointer select-none text-right"
                        onClick={() => handleSort("total")}
                    >
                        Total
                    </TableHead>

                    <TableHead>Status</TableHead>

                    <TableHead className="w-24 text-right">
                        Actions
                    </TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {isLoading && (
                    <TableRow>
                        <TableCell
                            colSpan={6}
                            className="py-8 text-center text-muted-foreground"
                        >
                            Loading…
                        </TableCell>
                    </TableRow>
                )}

                {!isLoading && rows.length === 0 && (
                    <TableRow>
                        <TableCell
                            colSpan={6}
                            className="py-10 text-center text-muted-foreground"
                        >
                            No tax invoices here yet.
                            {canCreateTaxInvoice && (
                                <>
                                    {" "}
                                    <Link
                                        to="/invoices/new"
                                        search={{ kind: "tax_invoice" }}
                                        className="text-primary hover:underline"
                                    >
                                        Create one
                                    </Link>.
                                </>
                            )}
                        </TableCell>
                    </TableRow>
                )}

                {sortedRows.map((r: any) => (
                    <TableRow
                        key={r.id}
                        className={`hover:bg-muted/40 ${r.status === "cancelled"
                                ? "opacity-60"
                                : ""
                            }`}
                    >
                        <TableCell className="font-mono text-sm font-medium">
                            <Link
                                to="/invoices/$id"
                                params={{ id: r.id }}
                                search={{ kind: "tax_invoice" }}
                                className="text-primary hover:underline"
                            >
                                {billNo(r.invoice_number)}
                            </Link>

                            {r.is_imported && (
                                <Badge
                                    variant="outline"
                                    className="ml-2 text-[9px] uppercase"
                                >
                                    Imported
                                </Badge>
                            )}
                        </TableCell>

                        <TableCell>
                            {r.customer_name_snapshot ?? "—"}
                        </TableCell>

                        <TableCell>
                            {formatDate(r.invoice_date)}
                        </TableCell>

                        <TableCell className="text-right tabular-nums font-semibold">
                            {formatINR(r.grand_total)}
                        </TableCell>

                        <TableCell>
                            <Badge
                                variant="outline"
                                className={`text-[10px] font-medium uppercase ${taxInvoiceStatusStyles[r.status] ?? ""
                                    }`}
                            >
                                {r.status}
                            </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                                {r.status !== "cancelled" && (
                                    <>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            asChild
                                            title="Edit"
                                        >
                                            <Link
                                                to="/invoices/$id/edit"
                                                params={{ id: r.id }}
                                                search={{
                                                    kind: "tax_invoice",
                                                }}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Link>
                                        </Button>

                                        {canCancelTaxInvoice && (
                                            <CancelInvoiceDialog
                                                invoiceId={r.id}
                                                invoiceNumber={r.invoice_number}
                                                onCancelled={() =>
                                                    qc.invalidateQueries({
                                                        queryKey: ["invoices"],
                                                    })
                                                }
                                                trigger={
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        title="Cancel invoice"
                                                    >
                                                        <Ban className="h-3.5 w-3.5 text-destructive" />
                                                    </Button>
                                                }
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
