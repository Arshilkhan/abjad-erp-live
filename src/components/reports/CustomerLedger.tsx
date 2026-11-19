
import { useEffect, useMemo, useState } from "react";
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

type FinancialYear = {
    id: string;
    year_label: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
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
};

type CustomerSummary = Customer & {
    customer: string;
    billed: number;
    paid: number;
    outstanding: number;
    invoiceCount: number;
};

/* ---------------- CSV helpers ---------------- */

function getLocalDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function escapeCSV(value: unknown) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function saveLedgerCSV(filename: string, rows: unknown[][]) {
    const csvContent = rows
        .map((row) => row.map(escapeCSV).join(","))
        .join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
        type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

function sortLedgerInvoices(invoices: Invoice[]) {
    return [...invoices].sort((a, b) => {
        const dateComparison = (a.invoice_date ?? "").localeCompare(
            b.invoice_date ?? "",
        );

        return dateComparison !== 0
            ? dateComparison
            : (a.invoice_number ?? "").localeCompare(
                  b.invoice_number ?? "",
              );
    });
}

function safeFilename(value: string) {
    return value
        .trim()
        .replace(/[^a-z0-9_-]/gi, "_")
        .replace(/_+/g, "_");
}

/* ---------------- Individual customer export ---------------- */

function downloadCustomerLedgerCSV(
    customer: CustomerSummary,
    invoices: Invoice[],
    financialYear: FinancialYear,
    effectiveEndDate: string,
) {
    if (!invoices.length) return;

    const sortedInvoices = sortLedgerInvoices(invoices);
    let runningTotal = 0;

    const rows: unknown[][] = [
        ["CUSTOMER LEDGER"],
        ["Customer Name", customer.customer],
        ["Billing Address", customer.billing_address ?? "—"],
        ["Financial Year", financialYear.year_label],
        ["Period Start", financialYear.start_date],
        ["Period End", effectiveEndDate],
        [],
        [
            "Invoice Number",
            "Invoice Date",
            "Invoice Type",
            "Invoice Total",
            "Amount Paid",
            "Grand Total",
        ],
    ];

    for (const invoice of sortedInvoices) {
        const invoiceTotal = Number(invoice.grand_total ?? 0);
        const amountPaid = Number(invoice.amount_paid ?? 0);

        runningTotal += invoiceTotal;

        rows.push([
            billNo(invoice.invoice_number),
            invoice.invoice_date ? formatDate(invoice.invoice_date) : "",
            "Tax Invoice",
            invoiceTotal.toFixed(2),
            amountPaid.toFixed(2),
            runningTotal.toFixed(2),
        ]);
    }

    saveLedgerCSV(
        `ledger_${safeFilename(customer.customer)}_${financialYear.year_label}_${today()}.csv`,
        rows,
    );
}

/* ---------------- Company-wide export ---------------- */

function downloadCompanyLedgerCSV(
    customers: Customer[],
    invoices: Invoice[],
    financialYear: FinancialYear,
    effectiveEndDate: string,
) {
    if (!invoices.length) return;

    const customerMap = new Map(
        customers.map((customer) => [customer.id, customer]),
    );

    const getCustomerName = (invoice: Invoice) => {
        const customer = customerMap.get(invoice.customer_id ?? "");

        return (
            customer?.company_name?.trim() ||
            customer?.customer_name?.trim() ||
            invoice.customer_name_snapshot ||
            "Unknown Customer"
        );
    };

    const sortedInvoices = [...invoices].sort((a, b) => {
        const nameComparison = getCustomerName(a).localeCompare(
            getCustomerName(b),
        );

        if (nameComparison !== 0) return nameComparison;

        const dateComparison = (a.invoice_date ?? "").localeCompare(
            b.invoice_date ?? "",
        );

        return dateComparison !== 0
            ? dateComparison
            : (a.invoice_number ?? "").localeCompare(
                  b.invoice_number ?? "",
              );
    });

    // Maintain a separate cumulative total for each customer.
    const runningTotals = new Map<string, number>();

    const rows: unknown[][] = [
        ["COMPANY-WIDE CUSTOMER LEDGER"],
        ["Financial Year", financialYear.year_label],
        ["Period Start", financialYear.start_date],
        ["Period End", effectiveEndDate],
        [],
        [
            "Customer Name",
            "Billing Address",
            "Invoice Number",
            "Invoice Date",
            "Invoice Type",
            "Invoice Total",
            "Amount Paid",
            "Grand Total",
        ],
    ];

    for (const invoice of sortedInvoices) {
        const customer = customerMap.get(invoice.customer_id ?? "");
        const customerName = getCustomerName(invoice);

        const customerKey =
            invoice.customer_id ?? `snapshot:${customerName}`;

        const invoiceTotal = Number(invoice.grand_total ?? 0);
        const amountPaid = Number(invoice.amount_paid ?? 0);

        const runningTotal =
            (runningTotals.get(customerKey) ?? 0) + invoiceTotal;

        runningTotals.set(customerKey, runningTotal);

        rows.push([
            customerName,
            customer?.billing_address ?? "",
            billNo(invoice.invoice_number),
            invoice.invoice_date ? formatDate(invoice.invoice_date) : "",
            "Tax Invoice",
            invoiceTotal.toFixed(2),
            amountPaid.toFixed(2),
            runningTotal.toFixed(2),
        ]);
    }

    saveLedgerCSV(
        `company_customer_ledger_${financialYear.year_label}_${today()}.csv`,
        rows,
    );
}

/* ---------------- Financial year selector ---------------- */

function FinancialYearSelector({
    financialYears,
    selectedFinancialYearId,
    onChange,
    disabled,
}: {
    financialYears: FinancialYear[];
    selectedFinancialYearId: string;
    onChange: (value: string) => void;
    disabled: boolean;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <label
                htmlFor="ledger-financial-year"
                className="text-sm font-medium"
            >
                Financial Year
            </label>

            <select
                id="ledger-financial-year"
                value={selectedFinancialYearId}
                onChange={(event) => onChange(event.target.value)}
                disabled={disabled || financialYears.length === 0}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
                {financialYears.length === 0 && (
                    <option value="">No financial years available</option>
                )}

                {financialYears.map((year) => (
                    <option key={year.id} value={year.id}>
                        {year.year_label}
                    </option>
                ))}
            </select>
        </div>
    );
}

/* ---------------- Customer Ledger ---------------- */

export function CustomerLedger() {
    const [selectedFinancialYearId, setSelectedFinancialYearId] =
        useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
        null,
    );
    const [search, setSearch] = useState("");

    /* Financial years */

    const {
        data: financialYears = [],
        isLoading: financialYearsLoading,
        error: financialYearsError,
    } = useQuery({
        queryKey: ["rep-ledger-financial-years"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("f_year")
                .select("id, year_label, start_date, end_date, is_active")
                .order("start_date", { ascending: false });

            if (error) throw error;

            return (data ?? []) as FinancialYear[];
        },
    });

    useEffect(() => {
        if (selectedFinancialYearId || financialYears.length === 0) return;

        const activeYear =
            financialYears.find((year) => year.is_active) ?? financialYears[0];

        setSelectedFinancialYearId(activeYear.id);
    }, [financialYears, selectedFinancialYearId]);

    const selectedFinancialYear = financialYears.find(
        (year) => year.id === selectedFinancialYearId,
    );

    /* Customers */

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

    /* Invoices */

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
                    status
                `)
                .eq("invoice_type", "tax_invoice")
                .neq("status", "cancelled")
                .order("invoice_date", { ascending: false });

            if (error) throw error;

            return (data ?? []) as Invoice[];
        },
    });

    /* Lifetime customer summary - not affected by FY selection */

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

    /* Search */

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

    /* Selected customer */

    const selectedCustomer = summary.find(
        (customer) => customer.id === selectedCustomerId,
    );

    /* Lifetime invoices for the on-screen customer table */

    const customerInvoices = useMemo(
        () =>
            invoices.filter(
                (invoice) => invoice.customer_id === selectedCustomerId,
            ),
        [invoices, selectedCustomerId],
    );

    /* Financial-year invoice filtering - used only for CSV exports */

    const financialYearEnd = selectedFinancialYear
        ? selectedFinancialYear.end_date < getLocalDateString()
            ? selectedFinancialYear.end_date
            : getLocalDateString()
        : "";

    const financialYearInvoices = useMemo(() => {
        if (!selectedFinancialYear) return [];

        return invoices.filter((invoice) => {
            if (!invoice.invoice_date) return false;

            return (
                invoice.invoice_date >= selectedFinancialYear.start_date &&
                invoice.invoice_date <= financialYearEnd
            );
        });
    }, [invoices, selectedFinancialYear, financialYearEnd]);

    const customerFinancialYearInvoices = useMemo(
        () =>
            financialYearInvoices.filter(
                (invoice) => invoice.customer_id === selectedCustomerId,
            ),
        [financialYearInvoices, selectedCustomerId],
    );

    /* Error state */

    if (customersError || invoicesError || financialYearsError) {
        return (
            <ReportCard title="Customer Ledger">
                <p className="py-6 text-center text-sm text-destructive">
                    Failed to load customer ledger. Please try again.
                </p>
            </ReportCard>
        );
    }

    /* ---------------- Customer detail view ---------------- */

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

                        {selectedCustomer.email && (
                            <span className="text-sm text-muted-foreground">
                                ({selectedCustomer.email})
                            </span>
                        )}
                    </span>
                }
                actions={
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            if (!selectedFinancialYear) return;

                            downloadCustomerLedgerCSV(
                                selectedCustomer,
                                customerFinancialYearInvoices,
                                selectedFinancialYear,
                                financialYearEnd,
                            );
                        }}
                        disabled={
                            !selectedFinancialYear ||
                            customerFinancialYearInvoices.length === 0
                        }
                    >
                        <Download className="mr-1 h-4 w-4" />
                        FY Ledger CSV
                    </Button>
                }
            >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <FinancialYearSelector
                        financialYears={financialYears}
                        selectedFinancialYearId={selectedFinancialYearId}
                        onChange={setSelectedFinancialYearId}
                        disabled={financialYearsLoading}
                    />

                    <span className="text-xs text-muted-foreground">
                        CSV export only
                    </span>
                </div>

                {/* Lifetime totals */}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">
                            Total Billed
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                            {formatINR(selectedCustomer.billed)}
                        </p>
                    </div>

                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">
                            Total Paid
                        </p>
                        <p className="text-lg font-semibold tabular-nums">
                            {formatINR(selectedCustomer.paid)}
                        </p>
                    </div>

                    <div className="rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">
                            Outstanding
                        </p>
                        <p className="text-lg font-semibold tabular-nums text-warning">
                            {formatINR(selectedCustomer.outstanding)}
                        </p>
                    </div>
                </div>

                {/* Lifetime invoice history */}

                <ReportTable>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Billed
                                </TableHead>
                                <TableHead className="text-right">
                                    Paid
                                </TableHead>
                                <TableHead className="text-right">
                                    Outstanding
                                </TableHead>
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

    /* ---------------- Customer summary view ---------------- */

    return (
        <ReportCard
            title="Customer Ledger"
            actions={
                <div className="flex flex-wrap gap-2">
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
                        Summary CSV
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            if (!selectedFinancialYear) return;

                            downloadCompanyLedgerCSV(
                                customers,
                                financialYearInvoices,
                                selectedFinancialYear,
                                financialYearEnd,
                            );
                        }}
                        disabled={
                            !selectedFinancialYear ||
                            financialYearInvoices.length === 0
                        }
                    >
                        <Download className="mr-1 h-4 w-4" />
                        FY Ledger CSV
                    </Button>
                </div>
            }
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <FinancialYearSelector
                    financialYears={financialYears}
                    selectedFinancialYearId={selectedFinancialYearId}
                    onChange={setSelectedFinancialYearId}
                    disabled={financialYearsLoading}
                />

                <span className="text-xs text-muted-foreground">
                    Financial year selection applies to exports only
                </span>
            </div>

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
                            <TableHead className="text-right">
                                Invoices
                            </TableHead>
                            <TableHead className="text-right">
                                Billed
                            </TableHead>
                            <TableHead className="text-right">
                                Paid
                            </TableHead>
                            <TableHead className="text-right">
                                Outstanding
                            </TableHead>
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
                                    onClick={() =>
                                        setSelectedCustomerId(customer.id)
                                    }
                                >
                                    <TableCell>
                                        <div className="font-medium">
                                            {customer.customer}
                                        </div>

                                        {customer.company_name &&
                                            customer.customer_name &&
                                            customer.company_name !==
                                                customer.customer_name && (
                                                <div className="text-xs text-muted-foreground">
                                                    {customer.customer_name}
                                                </div>
                                            )}
                                    </TableCell>

                                    <TableCell>
                                        {customer.mobile ?? "—"}
                                    </TableCell>

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
                                        className={`text-right tabular-nums font-semibold ${
                                            customer.outstanding > 0
                                                ? "text-warning"
                                                : ""
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
