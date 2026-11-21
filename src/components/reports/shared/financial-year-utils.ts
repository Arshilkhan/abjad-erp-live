import type { FinancialYear } from "./useFinancialYears";

export type InvoiceDateRecord = {
    invoice_date: string | null;
};

export function getLocalDateString(): string {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export function getFinancialYearEndDate(
    financialYear: FinancialYear,
    currentDate = getLocalDateString(),
): string {
    return financialYear.end_date < currentDate
        ? financialYear.end_date
        : currentDate;
}

export function filterInvoicesByFinancialYear<T extends InvoiceDateRecord>(
    invoices: T[],
    financialYear: FinancialYear | undefined,
    effectiveEndDate?: string,
): T[] {
    if (!financialYear) return [];

    const endDate =
        effectiveEndDate ?? getFinancialYearEndDate(financialYear);

    return invoices.filter((invoice) => {
        if (!invoice.invoice_date) return false;

        return (
            invoice.invoice_date >= financialYear.start_date &&
            invoice.invoice_date <= endDate
        );
    });
}