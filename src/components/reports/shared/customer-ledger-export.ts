import { billNo, formatDate } from "@/lib/format";
import { downloadCSVFile } from "./csv-utils";
import type { FinancialYear } from "./useFinancialYears";

export type LedgerCustomer = {
    id: string;
    customer: string;
    customer_name: string | null;
    company_name: string | null;
    billing_address: string | null;
};

export type LedgerInvoice = {
    id: string;
    customer_id: string | null;
    customer_name_snapshot: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    invoice_type: string | null;
    grand_total: number | null;
    amount_paid: number | null;
};

function safeFilename(value: string) {
    return value.trim().replace(/[^a-z0-9_-]/gi, "_").replace(/_+/g, "_");
}

function sortInvoices(invoices: LedgerInvoice[]) {
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

export function downloadCustomerLedgerCSV(
    customer: LedgerCustomer,
    invoices: LedgerInvoice[],
    financialYear: FinancialYear,
    effectiveEndDate: string,
    dateSuffix: string,
) {
    if (!invoices.length) return;

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

    for (const invoice of sortInvoices(invoices)) {
        const total = Number(invoice.grand_total ?? 0);
        const paid = Number(invoice.amount_paid ?? 0);

        runningTotal += total;

        rows.push([
            billNo(invoice.invoice_number),
            invoice.invoice_date ? formatDate(invoice.invoice_date) : "",
            "Tax Invoice",
            total.toFixed(2),
            paid.toFixed(2),
            runningTotal.toFixed(2),
        ]);
    }

    downloadCSVFile(
        `ledger_${safeFilename(customer.customer)}_${financialYear.year_label}_${dateSuffix}.csv`,
        rows,
    );
}

export function downloadCompanyLedgerCSV(
    customers: LedgerCustomer[],
    invoices: LedgerInvoice[],
    financialYear: FinancialYear,
    effectiveEndDate: string,
    dateSuffix: string,
) {
    if (!invoices.length) return;

    const customerMap = new Map(
        customers.map((customer) => [customer.id, customer]),
    );

    const getCustomerName = (invoice: LedgerInvoice) => {
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

        const total = Number(invoice.grand_total ?? 0);
        const paid = Number(invoice.amount_paid ?? 0);
        const runningTotal = (runningTotals.get(customerKey) ?? 0) + total;

        runningTotals.set(customerKey, runningTotal);

        rows.push([
            customerName,
            customer?.billing_address ?? "",
            billNo(invoice.invoice_number),
            invoice.invoice_date ? formatDate(invoice.invoice_date) : "",
            "Tax Invoice",
            total.toFixed(2),
            paid.toFixed(2),
            runningTotal.toFixed(2),
        ]);
    }

    downloadCSVFile(
        `company_customer_ledger_${financialYear.year_label}_${dateSuffix}.csv`,
        rows,
    );
}