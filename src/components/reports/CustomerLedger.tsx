
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, formatDate, billNo } from "@/lib/format";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ArrowLeft, Search } from "lucide-react";
import { ReportCard } from "./shared/ReportCard";
import { ReportTable } from "./shared/ReportTable";
import { downloadCSV, today } from "./shared/report-utils";

type Customer = {
    id: string;
    customer_name: string | null;
    company_name: string | null;
    billing_address: string | null;
    mobile: string | null;
    email: string | null;
};

type Invoice = {
    id: string;
    customer_id: string | null;
    customer_name_snapshot: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    invoice_type: string | null;
    grand_total: number | null;
    amount_paid: number | null;
    status: string | null;
    financial_year_id: string | null;
    financial_year: {
        year_label: string;
    } | null;
};

type CustomerSummary = Customer & {
    customer: string;
    billed: number;
    paid: number;
    outstanding: number;
    invoiceCount: number;
};

function downloadCustomerLedgerCSV(
    customer: CustomerSummary,
    invoices: Invoice[],
) {
    if (!invoices.length) return;

    // Oldest invoice first for cumulative totals.
    const sortedInvoices = [...invoices].sort((a, b) => {
        const dateComparison = (a.invoice_date ?? "").localeCompare(
            b.invoice_date ?? "",
        );

        return dateComparison !== 0
            ? dateComparison
            : (a.invoice_number ?? "").localeCompare(
                b.invoice_number ?? "",
            );
    });

    const escapeCSV = (value: unknown) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;

    // Collect the actual financial years represented in this ledger.
    const financialYears = [
        ...new Set(
            sortedInvoices
                .map((invoice) => invoice.financial_year?.year_label)
                .filter((year): year is string => Boolean(year)),
        ),
    ].sort();

    const financialYearLabel =
        financialYears.length > 0
            ? financialYears.join(", ")
            : "Not assigned";

    const headers = [
        "Invoice Number",
        "Invoice Date",
        "Invoice Type",
        "Invoice Total",
        "Amount Paid",
        "Grand Total",
    ];

    let runningTotal = 0;

    const rows = sortedInvoices.map((invoice) => {
        const invoiceTotal = Number(invoice.grand_total ?? 0);
        const amountPaid = Number(invoice.amount_paid ?? 0);

        runningTotal += invoiceTotal;

        return [
            billNo(invoice.invoice_number),
            invoice.invoice_date
                ? formatDate(invoice.invoice_date)
                : "",
            "Tax Invoice",
            invoiceTotal.toFixed(2),
            amountPaid.toFixed(2),
            runningTotal.toFixed(2),
        ];
    });

    const csvContent = [
        [escapeCSV("CUSTOMER LEDGER")].join(","),
        [
            escapeCSV("Customer Name"),
            escapeCSV(customer.customer),
        ].join(","),
        [
            escapeCSV("Billing Address"),
            escapeCSV(customer.billing_address ?? "—"),
        ].join(","),
        [
            escapeCSV("Financial Year"),
            escapeCSV(financialYearLabel),
        ].join(","),
        "",
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
        type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `ledger_${customer.customer.replace(
        /[^a-z0-9]/gi,
        "_",
    )}_${today()}.csv`;

    link.click();
    URL.revokeObjectURL(url);
}

export function CustomerLedger() {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
        null,
    );
    const [search, setSearch] = useState("");

    const {
        data: customers = [],
        isLoading: customersLoading,
        error: customersError,
    } = useQuery({
        queryKey: ["rep-ledger-customers"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select(
                    "id, customer_name, company_name, billing_address, mobile, email",
                )
                .order("customer_name");

            if (error) throw error;
            return (data ?? []) as Customer[];
        },
    });

    const {
        data: invoices = [],
        isLoading: invoicesLoading,
        error: invoicesError,
    } = useQuery({
        queryKey: ["rep-ledger-invoices"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("invoices")
                .select(`
                    id,
                    customer_id,
                    customer_name_snapshot,
                    invoice_number,
                    invoice_date,
                    invoice_type,
                    grand_total,
                    amount_paid,
                    status,
                    financial_year_id,
                    financial_year:f_year!invoices_financial_year_id_fkey(year_label)
                `)
                .eq("invoice_type", "tax_invoice")
                .neq("status", "cancelled")
                .order("invoice_date", { ascending: false });

            if (error) throw error;
            return (data ?? []) as Invoice[];
        },
    });

    const summary = useMemo<CustomerSummary[]>(() => {
        const invoiceMap = new Map<
            string,
            { billed: number; paid: number; invoiceCount: number }
        >();

        for (const invoice of invoices) {
            if (!invoice.customer_id) continue;

            const current = invoiceMap.get(invoice.customer_id) ?? {
                billed: 0,
                paid: 0,
                invoiceCount: 0,
            };

            current.billed += Number(invoice.grand_total ?? 0);
            current.paid += Number(invoice.amount_paid ?? 0);
            current.invoiceCount += 1;

            invoiceMap.set(invoice.customer_id, current);
        }

        return customers
            .map((customer) => {
                const totals = invoiceMap.get(customer.id) ?? {
                    billed: 0,
                    paid: 0,
                    invoiceCount: 0,
                };

                return {
                    ...customer,
                    customer:
                        customer.company_name?.trim() ||
                        customer.customer_name?.trim() ||
                        "Unnamed customer",
                    ...totals,
                    outstanding: totals.billed - totals.paid,
                };
            })
            .sort((a, b) => b.outstanding - a.outstanding);
    }, [customers, invoices]);

    const filteredCustomers = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return summary;

        return summary.filter((customer) =>
            [
                customer.customer,
                customer.customer_name,
                customer.company_name,
                customer.mobile,
                customer.email,
            ]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(term)),
        );
    }, [summary, search]);

    const selectedCustomer = summary.find(
        (customer) => customer.id === selectedCustomerId,
    );

    const customerInvoices = useMemo(
        () =>
            invoices.filter(
                (invoice) => invoice.customer_id === selectedCustomerId,
            ),
        [invoices, selectedCustomerId],
    );

    if (customersError || invoicesError) {
        return (
            <ReportCard title="Customer Ledger">
                <p className="py-6 text-center text-sm text-destructive">
                    Failed to load customer ledger. Please try again.
                </p>
            </ReportCard>
        );
    }

    if (selectedCustomerId && selectedCustomer) {
        return (
            <ReportCard
                title={
                    <span className="flex items-center gap-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedCustomerId(null)}
                            aria-label="Back to customers"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <span>{selectedCustomer.customer}</span>
                        <div className="space-y-1 text-sm text-muted-foreground">
                            {selectedCustomer.email && (
                                <p>({selectedCustomer.email})</p>
                            )}
                        </div>
                    </span>
                }
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                            downloadCustomerLedgerCSV(
                                selectedCustomer,
                                customerInvoices,
                            )
                        }
                    >
                        <Download className="mr-1 h-4 w-4" />
                        CSV
                    </Button>
                }
            >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Total Billed</p>
                        <p className="text-lg font-semibold tabular-nums">
                            {formatINR(selectedCustomer.billed)}
                        </p>
                    </div>

                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Total Paid</p>
                        <p className="text-lg font-semibold tabular-nums">
                            {formatINR(selectedCustomer.paid)}
                        </p>
                    </div>

                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="text-lg font-semibold tabular-nums text-warning">
                            {formatINR(selectedCustomer.outstanding)}
                        </p>
                    </div>
                </div>

                <ReportTable>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Billed</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Outstanding</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {customerInvoices.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="py-6 text-center text-muted-foreground"
                                    >
                                        No tax invoices found for this customer.
                                    </TableCell>
                                </TableRow>
                            )}

                            {customerInvoices.map((invoice) => {
                                const billed = Number(invoice.grand_total ?? 0);
                                const paid = Number(invoice.amount_paid ?? 0);

                                return (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-mono text-xs">
                                            {billNo(invoice.invoice_number)}
                                        </TableCell>
                                        <TableCell>
                                            {invoice.invoice_date
                                                ? formatDate(invoice.invoice_date)
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs uppercase">
                                            {invoice.status ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatINR(billed)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatINR(paid)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums font-semibold">
                                            {formatINR(billed - paid)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ReportTable>
            </ReportCard>
        );
    }

    return (
        <ReportCard
            title="Customer Ledger"
            actions={
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                        downloadCSV(
                            `customer_ledger_summary_${today()}.csv`,
                            summary.map((customer) => ({
                                Customer: customer.customer,
                                Mobile: customer.mobile ?? "",
                                "Invoice Count": customer.invoiceCount,
                                "Total Billed": customer.billed,
                                "Total Paid": customer.paid,
                                Outstanding: customer.outstanding,
                            })),
                        )
                    }
                    disabled={summary.length === 0}
                >
                    <Download className="mr-1 h-4 w-4" />
                    CSV
                </Button>
            }
        >
            <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customers by name, mobile or email..."
                    className="pl-9"
                />
            </div>

            <ReportTable>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Mobile</TableHead>
                            <TableHead className="text-right">Invoices</TableHead>
                            <TableHead className="text-right">Billed</TableHead>
                            <TableHead className="text-right">Paid</TableHead>
                            <TableHead className="text-right">Outstanding</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {customersLoading || invoicesLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    Loading customer ledger...
                                </TableCell>
                            </TableRow>
                        ) : filteredCustomers.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-6 text-center text-muted-foreground"
                                >
                                    {summary.length === 0
                                        ? "No customers found."
                                        : "No customers match your search."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <TableRow
                                    key={customer.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setSelectedCustomerId(customer.id)}
                                >
                                    <TableCell>
                                        <div className="font-medium">{customer.customer}</div>
                                        {customer.company_name &&
                                            customer.customer_name &&
                                            customer.company_name !== customer.customer_name && (
                                                <div className="text-xs text-muted-foreground">
                                                    {customer.customer_name}
                                                </div>
                                            )}
                                    </TableCell>

                                    <TableCell>{customer.mobile ?? "—"}</TableCell>

                                    <TableCell className="text-right tabular-nums">
                                        {customer.invoiceCount}
                                    </TableCell>

                                    <TableCell className="text-right tabular-nums">
                                        {formatINR(customer.billed)}
                                    </TableCell>

                                    <TableCell className="text-right tabular-nums">
                                        {formatINR(customer.paid)}
                                    </TableCell>

                                    <TableCell
                                        className={`text-right tabular-nums font-semibold ${customer.outstanding > 0 ? "text-warning" : ""
                                            }`}
                                    >
                                        {formatINR(customer.outstanding)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ReportTable>
        </ReportCard>
    );
}
