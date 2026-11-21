
type InvoiceNumberRecord = {
    invoice_number: string | null;
};

const invoiceNumberCollator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base",
});

export function sortByInvoiceNumber<T extends InvoiceNumberRecord>(
    invoices: T[],
): T[] {
    return [...invoices].sort((a, b) => {
        return invoiceNumberCollator.compare(
            a.invoice_number ?? "",
            b.invoice_number ?? "",
        );
    });
}
