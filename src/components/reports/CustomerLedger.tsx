
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

import { FinancialYearSelector } from "./shared/FinancialYearSelector";
import { useFinancialYears } from "./shared/useFinancialYears";

import {
    filterInvoicesByFinancialYear,
    getFinancialYearEndDate,
} from "./shared/financial-year-utils";

import {
    downloadCustomerLedgerCSV,
    downloadCompanyLedgerCSV,
} from "./shared/customer-ledger-export";

/* ---------------- Types ---------------- */

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
};

type CustomerSummary = Customer & {
    customer: string;
    billed: number;
    paid: number;
    outstanding: number;
    invoiceCount: number;
};

/* ---------------- Customer Ledger ---------------- */

export function CustomerLedger() {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
        null,
    );

    const [search, setSearch] = useState("");

    /* Financial years */

    const {
        financialYears,
        selectedFinancialYear,
        selectedFinancialYearId,
        setSelectedFinancialYearId,
        isLoading: financialYearsLoading,
        error: financialYearsError,
    } = useFinancialYears();

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

    /* Lifetime customer summary */

    const summary = useMemo<CustomerSummary[]>(() => {
        const invoiceMap = new Map<
            string,
            {
                billed: number;
                paid: number;
                invoiceCount: number;
            }
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

    /* Customer search */

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

    /* Lifetime invoices for customer detail table */

    const customerInvoices = useMemo(
        () =>
            invoices.filter(
                (invoice) => invoice.customer_id === selectedCustomerId,
            ),
        [invoices, selectedCustomerId],
    );

    /* Financial-year filtering - exports only */

    const financialYearEnd = selectedFinancialYear
        ? getFinancialYearEndDate(selectedFinancialYear)
        : "";

    const financialYearInvoices = useMemo(
        () =>
            filterInvoicesByFinancialYear(
                invoices,
                selectedFinancialYear,
                financialYearEnd,
            ),
        [invoices, selectedFinancialYear, financialYearEnd],
    );

    const customerFinancialYearInvoices = useMemo(
        () =>
            financialYearInvoices.filter(
                (invoice) => invoice.customer_id === selectedCustomerId,
            ),
        [financialYearInvoices, selectedCustomerId],
    );

    /* Prepare customer records for company-wide export */

    const exportCustomers = useMemo(
        () =>
            customers.map((customer) => ({
                ...customer,
                customer:
                    customer.company_name?.trim() ||
                    customer.customer_name?.trim() ||
                    "Unnamed customer",
            })),
        [customers],
    );

    /* Loading and error states */

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
                    <div className="flex min-w-0 items-center gap-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelectedCustomerId(null)}
                            aria-label="Back to customers"
                            className="shrink-0"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>

                        <div className="min-w-0">
                            <p className="truncate font-semibold">
                                {selectedCustomer.customer}
                            </p>

                            {selectedCustomer.email && (
                                <p className="truncate text-xs font-normal text-muted-foreground">
                                    {selectedCustomer.email}
                                </p>
                            )}
                        </div>
                    </div>
                }
            >
                {/* Financial-year export toolbar */}

                <div className="mx-3 mt-3 mb-4 flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium">
                            Export customer ledger
                        </p>

                        <p className="text-xs text-muted-foreground">
                            Export invoices for the selected financial year.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <FinancialYearSelector
                            financialYears={financialYears}
                            selectedFinancialYearId={selectedFinancialYearId}
                            onChange={setSelectedFinancialYearId}
                            disabled={financialYearsLoading}
                        />

                        <Button
                            size="sm"
                            onClick={() => {
                                if (!selectedFinancialYear) return;

                                downloadCustomerLedgerCSV(
                                    selectedCustomer,
                                    customerFinancialYearInvoices,
                                    selectedFinancialYear,
                                    financialYearEnd,
                                    today(),
                                );
                            }}
                            disabled={
                                !selectedFinancialYear ||
                                customerFinancialYearInvoices.length === 0
                            }
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                </div>

                {/* Lifetime totals */}

                <div className="mx-3 mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">
                            Total Billed
                        </p>

                        <p className="text-lg font-semibold tabular-nums">
                            {formatINR(selectedCustomer.billed)}
                        </p>
                    </div>

                    <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">
                            Total Paid
                        </p>

                        <p className="text-lg font-semibold tabular-nums">
                            {formatINR(selectedCustomer.paid)}
                        </p>
                    </div>

                    <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">
                            Outstanding
                        </p>

                        <p className="text-lg font-semibold tabular-nums text-warning">
                            {formatINR(selectedCustomer.outstanding)}
                        </p>
                    </div>
                </div>

                {/* Lifetime invoice history */}

                <div className="mx-3">
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
                </div>
            </ReportCard>
        );
    }

    /* ---------------- Customer summary view ---------------- */

    return (
        <ReportCard
            title="Customer Ledger"
            actions={
                <div className="flex flex-wrap items-center gap-2">
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
                        <Download className="mr-2 h-4 w-4" />
                        Summary CSV
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            if (!selectedFinancialYear) return;

                            downloadCompanyLedgerCSV(
                                exportCustomers,
                                financialYearInvoices,
                                selectedFinancialYear,
                                financialYearEnd,
                                today(),
                            );
                        }}
                        disabled={
                            !selectedFinancialYear ||
                            financialYearInvoices.length === 0
                        }
                    >
                        <Download className="mr-2 h-4 w-4" />
                        FY Ledger CSV
                    </Button>
                </div>
            }
        >
            {/* Financial-year toolbar */}

            <div className="mx-3 mt-3 mb-4 flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium">
                        Financial-year export
                    </p>

                    <p className="text-xs text-muted-foreground">
                        Select a financial year to export all customer invoices.
                        Lifetime totals remain unchanged.
                    </p>
                </div>

                <FinancialYearSelector
                    financialYears={financialYears}
                    selectedFinancialYearId={selectedFinancialYearId}
                    onChange={setSelectedFinancialYearId}
                    disabled={financialYearsLoading}
                />
            </div>

            {/* Search */}

            <div className="relative mb-3 mx-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search customers by name, mobile or email..."
                    className="pl-9"
                />
            </div>

            {/* Customer table */}

            <div className="mx-3">
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
                                            className={`text-right tabular-nums font-semibold ${customer.outstanding > 0
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
            </div>
        </ReportCard>
    );
}
