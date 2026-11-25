
import type ExcelJS from "exceljs";
import { billNo } from "@/lib/format";
import type { FinancialYear } from "./useFinancialYears";

export type LedgerCompanyProfile = {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    email: string | null;
    gst_number: string | null;
};

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

export type LedgerPayment = {
    id: string;
    customer_id: string | null;
    payment_date: string;
    amount: number | null;
    status: string;
};

export type LedgerOpeningBalance = {
    customer_id: string;
    financial_year: string;
    opening_balance: number;
};

type SummaryCustomer = {
    customer: string;
    mobile: string | null;
    invoiceCount: number;
    billed: number;
    paid: number;
    outstanding: number;
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const AMOUNT_FORMAT = "#,##0.00;[Red]-#,##0.00";
const collator = new Intl.Collator();
const ALIGN_LEFT = { horizontal: "left", vertical: "middle" } as const;
const ALIGN_RIGHT = { horizontal: "right", vertical: "middle" } as const;
const ALIGN_INFO = { horizontal: "left", vertical: "middle", wrapText: true } as const;

const PAGE_MARGINS = {
    left: 0.25,
    right: 0.25,
    top: 0.45,
    bottom: 0.45,
    header: 0.2,
    footer: 0.2,
};
function safeFilename(value: string) {
    return value.trim().replace(/[^a-z0-9_-]/gi, "_").replace(/_+/g, "_");
}

function fullBusinessAddress(company: LedgerCompanyProfile) {
    return [company.address, company.city, company.state, company.pincode]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(", ");
}

function formatDate(date: string | null | undefined) {
    if (!date) return "";

    const [year, month, day] = date.slice(0, 10).split("-");
    if (!year || !month || !day) return "";

    return `${day}-${month}-${year}`;
}

async function createWorkbook(): Promise<ExcelJS.Workbook> {
    const { default: Excel } = await import("exceljs");
    const workbook = new Excel.Workbook();
    workbook.creator = "ABJAD ERP";
    workbook.created = new Date();
    return workbook;
}

function styleTitle(cell: ExcelJS.Cell) {
    cell.font = { bold: true, size: 16 };
    cell.alignment = { vertical: "middle" };
}

function styleTableHeader(row: ExcelJS.Row) {
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF334155" },
    };
    row.alignment = { vertical: "middle", horizontal: "center" };
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
    widths.forEach((width, index) => {
        sheet.getColumn(index + 1).width = width;
    });
}

/** A4 landscape, fit to one page wide. Applied BEFORE the workbook is written. */
function applyLandscapePageSetup(sheet: ExcelJS.Worksheet, lastColumn: string) {
    sheet.pageSetup = {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: PAGE_MARGINS,
        horizontalDpi: 300,
        verticalDpi: 300,
        printArea: `A1:${lastColumn}${sheet.rowCount}`,
    };
}

function addCompanyAndCustomerHeader(
    sheet: ExcelJS.Worksheet,
    company: LedgerCompanyProfile,
    customer: LedgerCustomer,
    financialYear: FinancialYear,
    effectiveEndDate: string,
) {
    // Row 1: Company name
    sheet.mergeCells("A1:C1");
    sheet.getCell("A1").value = company.name || "Company";

    // Row 2: Company address
    sheet.mergeCells("A2:E2");
    sheet.getCell("A2").value = fullBusinessAddress(company);

    // Row 3: Company email
    sheet.mergeCells("A3:B3");
    sheet.getCell("A3").value = company.email ?? "";

    // Row 4: GSTIN
    sheet.mergeCells("A4:B4");
    sheet.getCell("A4").value = company.gst_number ?? "";

    // Row 5: Blank spacing

    // Row 6: Customer company name
    sheet.mergeCells("A6:D6");
    sheet.getCell("A6").value = customer.customer;

    // Row 7: Customer address
    sheet.mergeCells("A7:E7");
    sheet.getCell("A7").value = customer.billing_address ?? "";

    // Row 8: Blank spacing

    // Row 9: Financial period
    sheet.getCell("A9").value = "Period";
    sheet.mergeCells("B9:C9");
    sheet.getCell("B9").value =
        `${formatDate(financialYear.start_date)} to ${formatDate(effectiveEndDate)}`;

    // Row heights converted from pixels to points.
    const rowHeights = [21, 37.5, 22.5, 21, 8, 18.75, 18.75, 8, 18.75, 8];
    rowHeights.forEach((height, index) => {
        sheet.getRow(index + 1).height = height;
    });

    // Left alignment and vertical centering for information.
    for (const address of ["A1", "A2", "A3", "A4", "A6", "A7", "A9", "B9"]) {
        sheet.getCell(address).alignment = ALIGN_INFO;
    }

    sheet.getCell("A1").font = { bold: true, size: 12 };
    sheet.getCell("A6").font = { bold: true, size: 12 };
    sheet.getCell("A9").font = { bold: true };
    // (Column widths are set once, by the caller, after the data rows exist.)
}

function addCompanyHeader(
    sheet: ExcelJS.Worksheet,
    company: LedgerCompanyProfile,
    financialYear: FinancialYear,
    effectiveEndDate: string,
) {
    sheet.mergeCells("A1:H1");

    sheet.getCell("A1").value = company.name || "Company";
    styleTitle(sheet.getCell("A1"));

    const info = [
        ["Business Address", fullBusinessAddress(company)],
        ["Email", company.email ?? ""],
        ["GSTIN", company.gst_number ?? ""],
        ["Financial Year", financialYear.year_label],
        ["Period Start", financialYear.start_date],
        ["Period End", effectiveEndDate],
    ];

    info.forEach(([label, value], index) => {
        const row = index + 2;

        sheet.getCell(`A${row}`).value = label;
        sheet.mergeCells(`B${row}:H${row}`);
        sheet.getCell(`B${row}`).value = value;

        sheet.getCell(`A${row}`).font = { bold: true };
        sheet.getCell(`B${row}`).alignment = ALIGN_INFO;

        sheet.getRow(row).height = index === 0 ? 36 : 24;
    });

    sheet.addRow([]);
}

/** Applies the amount number format and right alignment to data rows (one row lookup per row, not per cell). */
function formatAmountColumns(sheet: ExcelJS.Worksheet, columns: number[], startRow: number) {
    columns.forEach((column) => {
        sheet.getColumn(column).numFmt = AMOUNT_FORMAT;
    });

    const lastRow = sheet.rowCount;
    for (let rowNumber = startRow; rowNumber <= lastRow; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        for (const column of columns) {
            row.getCell(column).alignment = ALIGN_RIGHT;
        }
    }
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: XLSX_MIME });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}
type LedgerTransaction =
    | { type: "invoice"; date: string; invoice: LedgerInvoice }
    | { type: "payment"; date: string; payment: LedgerPayment };

function sortLedgerTransactions(invoices: LedgerInvoice[], payments: LedgerPayment[]) {
    // Single pass per list (previously filter + map, i.e. two passes each).
    const transactions: LedgerTransaction[] = [];

    for (const invoice of invoices) {
        if (invoice.invoice_date) {
            transactions.push({ type: "invoice", date: invoice.invoice_date, invoice });
        }
    }
    for (const payment of payments) {
        if (payment.status === "received" && payment.payment_date) {
            transactions.push({ type: "payment", date: payment.payment_date, payment });
        }
    }

    return transactions.sort((a, b) => {
        const dateComparison = collator.compare(a.date, b.date);
        if (dateComparison !== 0) return dateComparison;

        if (a.type !== b.type) {
            return a.type === "invoice" ? -1 : 1;
        }

        if (a.type === "invoice" && b.type === "invoice") {
            return collator.compare(a.invoice.invoice_number ?? "", b.invoice.invoice_number ?? "");
        }

        return 0;
    });
}

export async function downloadCustomerLedgerXLSX(
    company: LedgerCompanyProfile,
    customer: LedgerCustomer,
    invoices: LedgerInvoice[],
    payments: LedgerPayment[],
    openingBalance: number,
    financialYear: FinancialYear,
    effectiveEndDate: string,
    dateSuffix: string,
) {
    const customerPayments = payments.filter(
        (payment) =>
            payment.customer_id === customer.id &&
            payment.status === "received" &&
            payment.payment_date >= financialYear.start_date &&
            payment.payment_date <= effectiveEndDate,
    );

    if (!invoices.length && !customerPayments.length && openingBalance === 0) return;

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Customer Ledger");

    addCompanyAndCustomerHeader(sheet, company, customer, financialYear, effectiveEndDate);

    const header = sheet.addRow(["Invoice No.", "Date", "Type", "Invoice Total", "Paid", "Grand Total"]);
    styleTableHeader(header);
    header.height = 22.5;
    header.alignment = ALIGN_LEFT;

    let runningTotal = openingBalance;

    const openingRow = sheet.addRow([
        "",
        formatDate(financialYear.start_date),
        "Opening Balance",
        "",
        "",
        runningTotal,
    ]);
    openingRow.alignment = ALIGN_LEFT;

    for (const transaction of sortLedgerTransactions(invoices, customerPayments)) {
        let row: ExcelJS.Row;

        if (transaction.type === "invoice") {
            const total = Number(transaction.invoice.grand_total ?? 0);
            runningTotal += total;

            row = sheet.addRow([
                billNo(transaction.invoice.invoice_number),
                formatDate(transaction.date),
                "Tax Invoice",
                total,
                0,
                runningTotal,
            ]);
        } else {
            const paid = Number(transaction.payment.amount ?? 0);
            runningTotal -= paid;

            row = sheet.addRow(["", formatDate(transaction.date), "Payment", "", paid, runningTotal]);
        }

        // Align at creation time: one row operation instead of 6 per-cell lookups later.
        row.alignment = ALIGN_LEFT;
    }

    // Final column widths (the earlier, overwritten width passes were removed).
    setColumnWidths(sheet, [18, 16, 18, 20, 20, 20]);

    [4, 5, 6].forEach((column) => {
        sheet.getColumn(column).numFmt = AMOUNT_FORMAT;
    });

    sheet.views = [{ state: "frozen", ySplit: 11 }];
    applyLandscapePageSetup(sheet, "F");

    await downloadWorkbook(
        workbook,
        `ledger_${safeFilename(customer.customer)}_${financialYear.year_label}_${dateSuffix}.xlsx`,
    );
}

export async function downloadCompanyLedgerXLSX(
    company: LedgerCompanyProfile,
    customers: LedgerCustomer[],
    invoices: LedgerInvoice[],
    openingBalances: LedgerOpeningBalance[],
    financialYear: FinancialYear,
    effectiveEndDate: string,
    dateSuffix: string,
) {
    if (!invoices.length && !openingBalances.length) return;

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Company Ledger");

    addCompanyHeader(sheet, company, financialYear, effectiveEndDate);

    // Build one opening-balance row per customer, followed by that customer's
    // invoices. Opening balances are scoped to the selected financial year.
    type CompanyLedgerEntry =
        | {
              type: "opening";
              customer: LedgerCustomer | undefined;
              name: string;
              openingBalance: number;
          }
        | {
              type: "invoice";
              customer: LedgerCustomer | undefined;
              name: string;
              invoice: LedgerInvoice;
          };

    const customerMap = new Map(customers.map((customer) => [customer.id, customer]));

    const entries: CompanyLedgerEntry[] = [];

    for (const balance of openingBalances) {
        const customer = customerMap.get(balance.customer_id);
        if (!customer) continue;

        const name =
            customer.company_name?.trim() ||
            customer.customer_name?.trim() ||
            "Unnamed customer";

        entries.push({
            type: "opening",
            customer,
            name,
            openingBalance: Number(balance.opening_balance ?? 0),
        });
    }

    for (const invoice of invoices) {
        const customer = customerMap.get(invoice.customer_id ?? "");
        const name =
            customer?.company_name?.trim() ||
            customer?.customer_name?.trim() ||
            invoice.customer_name_snapshot ||
            "Unknown Customer";

        entries.push({ type: "invoice", invoice, customer, name });
    }

    entries.sort((a, b) => {
        const nameComparison = collator.compare(a.name, b.name);
        if (nameComparison !== 0) return nameComparison;

        // Always place the opening balance before the customer's invoices.
        if (a.type !== b.type) return a.type === "opening" ? -1 : 1;

        if (a.type === "invoice" && b.type === "invoice") {
            return (
                collator.compare(a.invoice.invoice_date ?? "", b.invoice.invoice_date ?? "") ||
                collator.compare(a.invoice.invoice_number ?? "", b.invoice.invoice_number ?? "")
            );
        }

        return 0;
    });

    const runningTotals = new Map<string, number>();

    const header = sheet.addRow([
        "Customer Name",
        "Billing Address",
        "Invoice Number",
        "Date",
        "Invoice Type",
        "Invoice Total",
        "Amount Paid",
        "Grand Total",
    ]);
    styleTableHeader(header);

    for (const entry of entries) {
        const customerKey = entry.customer?.id ?? `snapshot:${entry.name}`;
        let row: ExcelJS.Row;

        if (entry.type === "opening") {
            runningTotals.set(customerKey, entry.openingBalance);

            row = sheet.addRow([
                entry.name,
                entry.customer?.billing_address ?? "",
                "",
                formatDate(financialYear.start_date),
                "Opening Balance",
                "",
                "",
                entry.openingBalance,
            ]);
        } else {
            const total = Number(entry.invoice.grand_total ?? 0);
            const runningTotal = (runningTotals.get(customerKey) ?? 0) + total;

            runningTotals.set(customerKey, runningTotal);

            row = sheet.addRow([
                entry.name,
                entry.customer?.billing_address ?? "",
                billNo(entry.invoice.invoice_number),
                formatDate(entry.invoice.invoice_date),
                "Tax Invoice",
                total,
                Number(entry.invoice.amount_paid ?? 0),
                runningTotal,
            ]);
        }

        row.alignment = ALIGN_LEFT;
    }

    setColumnWidths(sheet, [28, 36, 20, 16, 18, 20, 20, 20]);

    formatAmountColumns(sheet, [6, 7, 8], 10);
    sheet.views = [{ state: "frozen", ySplit: 9 }];
    applyLandscapePageSetup(sheet, "H");

    await downloadWorkbook(
        workbook,
        `company_customer_ledger_${financialYear.year_label}_${dateSuffix}.xlsx`,
    );
}

export async function downloadCustomerLedgerSummaryXLSX(
    customers: SummaryCustomer[],
    dateSuffix: string,
) {
    if (!customers.length) return;

    const workbook = await createWorkbook();
    const sheet = workbook.addWorksheet("Customer Summary");

    sheet.mergeCells("A1:F1");
    sheet.getCell("A1").value = "CUSTOMER LEDGER SUMMARY";
    styleTitle(sheet.getCell("A1"));

    const header = sheet.addRow(["Customer", "Mobile", "Invoice Count", "Total Billed", "Total Paid", "Outstanding"]);
    styleTableHeader(header);

    sheet.addRows(
        customers.map((customer) => [
            customer.customer,
            customer.mobile ?? "",
            customer.invoiceCount,
            customer.billed,
            customer.paid,
            customer.outstanding,
        ]),
    );

    setColumnWidths(sheet, [30, 18, 16, 20, 20, 20]);

    formatAmountColumns(sheet, [4, 5, 6], 3);
    sheet.views = [{ state: "frozen", ySplit: 2 }];

    await downloadWorkbook(workbook, `customer_ledger_summary_${dateSuffix}.xlsx`);
}