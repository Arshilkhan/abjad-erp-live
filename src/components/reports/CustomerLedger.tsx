import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
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
import { today } from "./shared/report-utils";

import { FinancialYearSelector } from "./shared/FinancialYearSelector";
import { useFinancialYears } from "./shared/useFinancialYears";

import {
    filterInvoicesByFinancialYear,
    getFinancialYearEndDate,
} from "./shared/financial-year-utils";

import {
    downloadCustomerLedgerXLSX,
    downloadCompanyLedgerXLSX,
    downloadCustomerLedgerSummaryXLSX,
    type LedgerCompanyProfile,
} from "./shared/customer-ledger-export";

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

type Payment = {
    id: string;
    customer_id: string | null;
    payment_date: string;
    amount: number | null;
    status: string;
};

type CustomerOpeningBalance = {
    customer_id: string;
    financial_year: string;
    opening_balance: number;
};

type CustomerSummary = Customer & {
    customer: string;
    billed: number;
    paid: number;
    outstanding: number;
    invoiceCount: number;
};
const EMPTY_INVOICES: Invoice[] = [];
const EMPTY_NOTES: Invoice[] = [];
const EMPTY_PAYMENTS: Payment[] = [];
const EMPTY_OPENING_BALANCES: CustomerOpeningBalance[] = [];
const COMPANY_PROFILE_STALE_MS = 10 * 60 * 1000;

const TRANSACTION_TABLE_HEADER = (
    <TableHeader>
        <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Transaction</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
        </TableRow>
    </TableHeader>
);

const CUSTOMER_TABLE_HEADER = (
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
);

const customerDisplayName = (customer: Customer) =>
    customer.company_name?.trim() ||
    customer.customer_name?.trim() ||
    "Unnamed customer";

function TotalTile({
    label,
    value,
    valueClassName = "",
}: {
    label: string;
    value: number;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-semibold tabular-nums ${valueClassName}`}>
                {formatINR(value)}
            </p>
        </div>
    );
}

type LedgerDisplayTransaction =
    | { id: string; kind: "document"; date: string; document: Invoice }
    | { id: string; kind: "payment"; date: string; payment: Payment };

type LedgerDisplayRow = {
    id: string;
    reference: string;
    date: string;
    type: string;
    status: string;
    debit: number;
    credit: number;
    balance: number;
};

const documentLabel = (type: string | null) => {
    switch (type) {
        case "tax_invoice": return "Tax Invoice";
        case "credit_note": return "Credit Note";
        case "debit_note": return "Debit Note";
        default: return "Document";
    }
};

const CustomerRow = memo(function CustomerRow({
    customer,
    onSelect,
}: {
    customer: CustomerSummary;
    onSelect: (id: string) => void;
}) {
    return (
        <TableRow
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onSelect(customer.id)}
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
                className={`text-right tabular-nums font-semibold ${
                    customer.outstanding > 0 ? "text-warning" : ""
                }`}
            >
                {formatINR(customer.outstanding)}
            </TableCell>
        </TableRow>
    );
});

export function CustomerLedger() {
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
        null,
    );

    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search);

    const {
        financialYears,
        selectedFinancialYear,
        selectedFinancialYearId,
        setSelectedFinancialYearId,
        isLoading: financialYearsLoading,
        error: financialYearsError,
    } = useFinancialYears();
    const {
        data: companyProfile,
        isLoading: companyProfileLoading,
        error: companyProfileError,
    } = useQuery({
        queryKey: ["rep-ledger-company-profile"],
        staleTime: COMPANY_PROFILE_STALE_MS,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("company_profile")
                .select("name, address, city, state, pincode, email, gst_number")
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            return data as LedgerCompanyProfile | null;
        },
    });

    const {
        data: customers = [],
        isLoading: customersLoading,
        error: customersError,
    } = useQuery({
        queryKey: ["rep-ledger-customers"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select("id, customer_name, company_name, billing_address, mobile, email")
                .order("customer_name");

            if (error) throw error;

            return (data ?? []) as Customer[];
        },
    });

    const {
        data: invoices = EMPTY_INVOICES,
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
                .in("status", ["sent", "paid", "partial"])
                .order("invoice_date", { ascending: false });

            if (error) throw error;

            return (data ?? []) as Invoice[];
        },
    });

    const {
        data: notes = EMPTY_NOTES,
        isLoading: notesLoading,
        error: notesError,
    } = useQuery({
        queryKey: ["rep-ledger-credit-debit-notes"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("cd_notes")
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
                .in("invoice_type", ["credit_note", "debit_note"])
                .in("status", ["sent", "paid", "partial"])
                .order("invoice_date", { ascending: false });

            if (error) throw error;

            return (data ?? []) as Invoice[];
        },
    });

    const {
        data: payments = EMPTY_PAYMENTS,
        isLoading: paymentsLoading,
        error: paymentsError,
    } = useQuery({
        queryKey: ["rep-ledger-payments"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("payments")
                .select("id, customer_id, payment_date, amount, status")
                .eq("status", "received")
                .order("payment_date", { ascending: true });

            if (error) throw error;

            return (data ?? []) as Payment[];
        },
    });
    const {
        data: openingBalances = EMPTY_OPENING_BALANCES,
        isLoading: openingBalancesLoading,
        error: openingBalancesError,
    } = useQuery({
        queryKey: ["rep-ledger-opening-balances", selectedFinancialYear?.year_label],
        enabled: Boolean(selectedFinancialYear?.year_label),
        queryFn: async () => {
            if (!selectedFinancialYear?.year_label) {
                return EMPTY_OPENING_BALANCES;
            }

            const { data, error } = await supabase
                .from("customer_opening_balances")
                .select("customer_id, financial_year, opening_balance")
                .eq("financial_year", selectedFinancialYear.year_label);

            if (error) throw error;

            return (data ?? []) as CustomerOpeningBalance[];
        },
    });

    const documents = useMemo(() => [...invoices, ...notes], [invoices, notes]);

    const invoicesByCustomer = useMemo(() => {
        const groups = new Map<string, Invoice[]>();

        for (const invoice of invoices) {
            if (!invoice.customer_id) continue;

            const group = groups.get(invoice.customer_id);
            if (group) group.push(invoice);
            else groups.set(invoice.customer_id, [invoice]);
        }

        return groups;
    }, [invoices]);
    const summary = useMemo<CustomerSummary[]>(() => {
        return customers
            .map((customer) => {
                let billed = 0;
                let paid = 0;
                const group = invoicesByCustomer.get(customer.id);

                if (group) {
                    for (const invoice of group) {
                        billed += Number(invoice.grand_total ?? 0);
                        paid += Number(invoice.amount_paid ?? 0);
                    }
                }

                return {
                    ...customer,
                    customer: customerDisplayName(customer),
                    billed,
                    paid,
                    invoiceCount: group?.length ?? 0,
                    outstanding: billed - paid,
                };
            })
            .sort((a, b) => b.outstanding - a.outstanding);
    }, [customers, invoicesByCustomer]);
    const searchIndex = useMemo(
        () =>
            summary.map((customer) =>
                [
                    customer.customer,
                    customer.customer_name,
                    customer.company_name,
                    customer.mobile,
                    customer.email,
                ]
                    .filter(Boolean)
                    .join("\n")
                    .toLowerCase(),
            ),
        [summary],
    );
    const filteredCustomers = useMemo(() => {
        const term = deferredSearch.trim().toLowerCase();

        if (!term) return summary;

        return summary.filter((_, index) => searchIndex[index].includes(term));
    }, [summary, searchIndex, deferredSearch]);

    const selectedCustomer = useMemo(
        () => summary.find((customer) => customer.id === selectedCustomerId),
        [summary, selectedCustomerId],
    );
    const financialYearEnd = useMemo(
        () =>
            selectedFinancialYear
                ? getFinancialYearEndDate(selectedFinancialYear)
                : "",
        [selectedFinancialYear],
    );

    const financialYearInvoices = useMemo(
        () =>
            filterInvoicesByFinancialYear(
                documents,
                selectedFinancialYear,
                financialYearEnd,
            ),
        [documents, selectedFinancialYear, financialYearEnd],
    );
    const customerFinancialYearInvoices = useMemo(
        () =>
            selectedCustomerId
                ? financialYearInvoices.filter(
                      (invoice) => invoice.customer_id === selectedCustomerId,
                  )
                : EMPTY_INVOICES,
        [financialYearInvoices, selectedCustomerId],
    );
    const selectedCustomerOpeningBalance = useMemo(
        () =>
            openingBalances.find(
                (balance) => balance.customer_id === selectedCustomerId,
            ) ?? null,
        [openingBalances, selectedCustomerId],
    );

    const customerFinancialYearPayments = useMemo(() => {
        if (!selectedCustomerId) return EMPTY_PAYMENTS;

        const start = selectedFinancialYear?.start_date ?? "";

        return payments.filter(
            (payment) =>
                payment.customer_id === selectedCustomerId &&
                payment.status === "received" &&
                payment.payment_date >= start &&
                payment.payment_date <= financialYearEnd,
        );
    }, [payments, selectedCustomerId, selectedFinancialYear, financialYearEnd]);

    const financialYearPayments = useMemo(() => {
        const start = selectedFinancialYear?.start_date ?? "";
        if (!start || !financialYearEnd) return EMPTY_PAYMENTS;

        return payments.filter(
            (payment) =>
                payment.status === "received" &&
                payment.payment_date >= start &&
                payment.payment_date <= financialYearEnd,
        );
    }, [payments, selectedFinancialYear, financialYearEnd]);

    const customerLedgerRows = useMemo<LedgerDisplayRow[]>(() => {
        if (!selectedCustomerId || !selectedFinancialYear) return [];

        const transactions: LedgerDisplayTransaction[] = [
            ...customerFinancialYearInvoices
                .filter((document) => Boolean(document.invoice_date))
                .map((document) => ({
                    id: document.id,
                    kind: "document" as const,
                    date: document.invoice_date!,
                    document,
                })),
            ...customerFinancialYearPayments
                .filter((payment) => Boolean(payment.payment_date))
                .map((payment) => ({
                    id: payment.id,
                    kind: "payment" as const,
                    date: payment.payment_date,
                    payment,
                })),
        ];

        transactions.sort((a, b) => {
            const byDate = a.date.localeCompare(b.date);
            if (byDate !== 0) return byDate;
            if (a.kind !== b.kind) return a.kind === "document" ? -1 : 1;
            if (a.kind === "document" && b.kind === "document") {
                const priority = (type: string | null) =>
                    type === "credit_note" ? 1 : 0;
                const priorityDifference = priority(a.document.invoice_type) - priority(b.document.invoice_type);
                if (priorityDifference !== 0) return priorityDifference;
                return (a.document.invoice_number ?? "").localeCompare(
                    b.document.invoice_number ?? "",
                    undefined,
                    { numeric: true, sensitivity: "base" },
                );
            }
            return a.id.localeCompare(b.id);
        });

        let balance = Number(selectedCustomerOpeningBalance?.opening_balance ?? 0);
        const rows: LedgerDisplayRow[] = [{
            id: `opening-${selectedCustomerId}-${selectedFinancialYear.id}`,
            reference: "—",
            date: selectedFinancialYear.start_date,
            type: "Opening Balance",
            status: "—",
            debit: 0,
            credit: 0,
            balance,
        }];

        for (const transaction of transactions) {
            if (transaction.kind === "payment") {
                const amount = Number(transaction.payment.amount ?? 0);
                balance -= amount;
                rows.push({
                    id: transaction.id,
                    reference: "—",
                    date: transaction.date,
                    type: "Payment",
                    status: "Received",
                    debit: 0,
                    credit: amount,
                    balance,
                });
                continue;
            }

            const document = transaction.document;
            const amount = Number(document.grand_total ?? 0);
            const isCreditNote = document.invoice_type === "credit_note";
            const isDebit = document.invoice_type === "debit_note" || document.invoice_type === "tax_invoice";
            const debit = isDebit ? amount : 0;
            const credit = isCreditNote ? amount : 0;
            balance += debit - credit;

            rows.push({
                id: transaction.id,
                reference: billNo(document.invoice_number),
                date: transaction.date,
                type: documentLabel(document.invoice_type),
                status: document.status ?? "—",
                debit,
                credit,
                balance,
            });
        }

        return rows;
    }, [
        selectedCustomerId,
        selectedFinancialYear,
        customerFinancialYearInvoices,
        customerFinancialYearPayments,
        selectedCustomerOpeningBalance,
    ]);

    const isExportLoading =
        companyProfileLoading ||
        customersLoading ||
        invoicesLoading ||
        notesLoading ||
        paymentsLoading ||
        openingBalancesLoading;

    const canExport = Boolean(companyProfile);
    const exportCustomerLedger = useCallback(() => {
        if (!selectedFinancialYear || !companyProfile || !selectedCustomer) {
            return;
        }

        void downloadCustomerLedgerXLSX(
            companyProfile,
            selectedCustomer,
            customerFinancialYearInvoices,
            customerFinancialYearPayments,
            Number(selectedCustomerOpeningBalance?.opening_balance ?? 0),
            selectedFinancialYear,
            financialYearEnd,
            today(),
        );
    }, [
        selectedFinancialYear,
        companyProfile,
        selectedCustomer,
        customerFinancialYearInvoices,
        customerFinancialYearPayments,
        selectedCustomerOpeningBalance,
        financialYearEnd,
    ]);

    const exportSummary = useCallback(() => {
        void downloadCustomerLedgerSummaryXLSX(summary, today());
    }, [summary]);

    const exportCompanyLedger = useCallback(() => {
        if (!selectedFinancialYear || !companyProfile) return;

        void downloadCompanyLedgerXLSX(
            companyProfile,
            summary,
            financialYearInvoices,
            financialYearPayments,
            openingBalances,
            selectedFinancialYear,
            financialYearEnd,
            today(),
        );
    }, [
        selectedFinancialYear,
        companyProfile,
        summary,
        financialYearInvoices,
        financialYearPayments,
        openingBalances,
        financialYearEnd,
    ]);

    const clearSelection = useCallback(() => setSelectedCustomerId(null), []);
    if (
        customersError ||
        invoicesError ||
        notesError ||
        paymentsError ||
        openingBalancesError ||
        financialYearsError ||
        companyProfileError
    ) {
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
                    <div className="flex min-w-0 items-center gap-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={clearSelection}
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
                            Export opening balance, invoices, credit/debit notes
                            and received payments for the selected financial year.
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
                            onClick={exportCustomerLedger}
                            disabled={
                                isExportLoading ||
                                !canExport ||
                                !selectedFinancialYear ||
                                (customerFinancialYearInvoices.length === 0 &&
                                    customerFinancialYearPayments.length === 0 &&
                                    !selectedCustomerOpeningBalance)
                            }
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export XLSX
                        </Button>
                    </div>
                </div>

                {/* Lifetime totals */}

                <div className="mx-3 mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <TotalTile label="Total Billed" value={selectedCustomer.billed} />
                    <TotalTile label="Total Paid" value={selectedCustomer.paid} />
                    <TotalTile
                        label="Outstanding"
                        value={selectedCustomer.outstanding}
                        valueClassName="text-warning"
                    />
                </div>

                {/* Selected financial-year transaction history */}

                <div className="mx-3">
                    <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Transaction History</h3>
                        <span className="text-xs text-muted-foreground">
                            {selectedFinancialYear?.year_label ?? "Select a financial year"}
                        </span>
                    </div>
                    <ReportTable>
                        <Table>
                            {TRANSACTION_TABLE_HEADER}
                            <TableBody>
                                {customerLedgerRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                            No transactions found for this financial year.
                                        </TableCell>
                                    </TableRow>
                                ) : customerLedgerRows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                                        <TableCell>{formatDate(row.date)}</TableCell>
                                        <TableCell className="text-xs">{row.type}</TableCell>
                                        <TableCell className="text-xs uppercase">{row.status}</TableCell>
                                        <TableCell className="text-right tabular-nums">{row.debit ? formatINR(row.debit) : "—"}</TableCell>
                                        <TableCell className="text-right tabular-nums">{row.credit ? formatINR(row.credit) : "—"}</TableCell>
                                        <TableCell className="text-right tabular-nums font-semibold">{formatINR(row.balance)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ReportTable>
                </div>
            </ReportCard>
        );
    }
    return (
        <ReportCard
            title="Customer Ledger"
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={exportSummary}
                        disabled={isExportLoading || summary.length === 0}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Summary XLSX
                    </Button>

                    <Button
                        size="sm"
                        onClick={exportCompanyLedger}
                        disabled={
                            isExportLoading ||
                            !canExport ||
                            !selectedFinancialYear ||
                            financialYearInvoices.length === 0 &&
                            financialYearPayments.length === 0 &&
                            openingBalances.length === 0
                        }
                    >
                        <Download className="mr-2 h-4 w-4" />
                        FY Ledger XLSX
                    </Button>
                </div>
            }
        >
            {/* Financial-year toolbar */}

            <div className="mx-3 mt-3 mb-4 flex flex-col gap-3 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium">Financial-year export</p>

                    <p className="text-xs text-muted-foreground">
                        Select a financial year to export customer opening
                        balances, invoices, credit/debit notes and payments.
                        Lifetime summary totals remain unchanged.
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
                        {CUSTOMER_TABLE_HEADER}

                        <TableBody>
                            {customersLoading || invoicesLoading || notesLoading ? (
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
                                    <CustomerRow
                                        key={customer.id}
                                        customer={customer}
                                        onSelect={setSelectedCustomerId}
                                    />
                                ))
                            )}
                        </TableBody>
                    </Table>
                </ReportTable>
            </div>
        </ReportCard>
    );
}