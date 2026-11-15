
import type { Dispatch, SetStateAction } from "react";

type Setter<T> = Dispatch<SetStateAction<T>>;

interface PdfImportItem {
  description: string;
  hsn_code?: string;
  quantity: number;
  uom: string;
  unit_rate: number;
  discount_pct?: number;
  tax_pct?: number;
}

interface PdfImportData {
  customer_name?: string;
  customer_address?: string;
  company_name?: string;
  mobile?: string;
  footer_contact_mobiles?: string[];
  email?: string;
  gst_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  work_order_number?: string;
  freight?: number;
  packing_charges?: number;
  other_charges?: number;
  delivery_mode?: string;
  payment_terms?: string;
  notes?: string;
  items: PdfImportItem[];
  po_number?: string;
  po_date?: string;
  reference_challan_number?: string;
  reference_challan_dates?: string[];
}

interface ImportPdfArgs {
  file: File;
  runExtract: (args: {
    data: { fileData: string; fileName: string };
  }) => Promise<PdfImportData>;
  customers: any[];
  products: any[];
  isTaxInvoice: boolean;
  setPdfName: Setter<string>;
  setCustAddress: Setter<string>;
  setPdfImported: Setter<boolean>;
  setExtracting: Setter<boolean>;
  setCustomerId: Setter<string>;
  setCustomerText: Setter<string>;
  setCustCompany: Setter<string>;
  setCustMobile: Setter<string>;
  setCustEmail: Setter<string>;
  setCustGst: Setter<string>;
  setDocumentNumber: Setter<string>;
  setInvoiceDate: Setter<string>;
  setWorkOrder: Setter<string>;
  setFreight: Setter<number>;
  setPacking: Setter<number>;
  setOtherCharges: Setter<number>;
  setDeliveryMode: Setter<string>;
  setPaymentTerms: Setter<string>;
  setNotes: Setter<string>;
  setItems: Setter<any[]>;
  setProductTexts: Setter<string[]>;
  setPoNumber: Setter<string>;
  setPoDate: Setter<string>;
  setReferenceChallanNumber: Setter<string>;
  setReferenceChallanDates: Setter<string[]>;
  toast: {
    error: (message: string) => unknown;
    success: (message: string) => unknown;
  };
}

const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const DEFAULT_TAX_PCT = 18;

const lower = (s: unknown) => String(s ?? "").toLowerCase();

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function buildIdIndex(rows: any[], nameFields: string[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const row of rows) {
    for (const field of nameFields) {
      const key = lower(row[field]);
      if (key && !index.has(key)) index.set(key, row.id);
    }
  }

  return index;
}

/** Calls setter only when the value is truthy. */
function applyIfPresent<T>(
  setter: Setter<T>,
  value: T | undefined | null
) {
  if (value) setter(value);
}

export async function importInvoicePdf({
  file,
  runExtract,
  customers,
  products,
  isTaxInvoice,
  setDocumentNumber,
  setCustAddress,
  setPdfName,
  setPdfImported,
  setExtracting,
  setCustomerId,
  setCustomerText,
  setCustCompany,
  setCustMobile,
  setCustEmail,
  setCustGst,
  setInvoiceDate,
  setWorkOrder,
  setFreight,
  setPacking,
  setOtherCharges,
  setDeliveryMode,
  setPaymentTerms,
  setNotes,
  setItems,
  setProductTexts,
  setPoNumber,
  setPoDate,
  setReferenceChallanNumber,
  setReferenceChallanDates,
  toast,
}: ImportPdfArgs): Promise<void> {
  // Validate before touching any state.
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    toast.error("Please choose a PDF, DOC, or DOCX file.");
    return;
  }

  if (file.size > MAX_FILE_BYTES) {
    toast.error("Document is too large (max 15 MB).");
    return;
  }

  setPdfName(file.name);
  setPdfImported(false);
  setExtracting(true);

  try {
    const fileData = await readFileAsDataURL(file);
    const d = await runExtract({
      data: { fileData, fileName: file.name },
    });

    // Customer details.
    if (d.customer_name) {
      const customerIndex = buildIdIndex(customers, [
        "customer_name",
        "company_name",
      ]);

      setCustomerId(customerIndex.get(lower(d.customer_name)) ?? "");
      setCustomerText(d.customer_name);
    }

    const companyName = d.customer_name || d.company_name;
    if (companyName) setCustCompany(companyName);

    const footerMobiles = d.footer_contact_mobiles?.length
      ? d.footer_contact_mobiles.join(" / ")
      : "";

    if (footerMobiles && !d.mobile) {
      setCustMobile(footerMobiles);
    }

    applyIfPresent(setCustEmail, d.email);
    applyIfPresent(setCustGst, d.gst_number);
    applyIfPresent(setCustAddress, d.customer_address);
    applyIfPresent(setPoNumber, d.po_number);
    applyIfPresent(setPoDate, d.po_date);
    applyIfPresent(setReferenceChallanNumber, d.reference_challan_number);

    if (d.reference_challan_dates?.length) {
      setReferenceChallanDates(d.reference_challan_dates);
    }

    applyIfPresent(setDocumentNumber, d.invoice_number);
    applyIfPresent(setInvoiceDate, d.invoice_date);
    applyIfPresent(setWorkOrder, d.work_order_number);

    if (isTaxInvoice) {
      applyIfPresent(setFreight, d.freight);
      applyIfPresent(setPacking, d.packing_charges);
      applyIfPresent(setOtherCharges, d.other_charges);
    }

    // Delivery details and terms.
    applyIfPresent(setDeliveryMode, d.delivery_mode);
    applyIfPresent(setPaymentTerms, d.payment_terms);
    applyIfPresent(setNotes, d.notes);

    // Line items.
    const importedItems = d.items;

    if (importedItems.length) {
      const productIndex = buildIdIndex(products, ["product_name"]);
      const nextItems = new Array(importedItems.length);
      const nextTexts = new Array<string>(importedItems.length);

      for (let i = 0; i < importedItems.length; i++) {
        const it = importedItems[i];

        nextItems[i] = {
          sr_no: i + 1,
          product_id: productIndex.get(lower(it.description)) ?? null,
          hsn_code: it.hsn_code,
          description: it.description,
          quantity: it.quantity,
          uom: it.uom,
          unit_rate: it.unit_rate,
          discount_mode: "pct" as const,
          discount_value: Number(it.discount_pct ?? 0),
          tax_pct: it.tax_pct || DEFAULT_TAX_PCT,
          serial_batch_number: "",
        };

        nextTexts[i] = it.description;
      }

      setItems(nextItems);
      setProductTexts(nextTexts);
    }

    setPdfImported(true);

    const count = importedItems.length;
    toast.success(
      `Imported ${count} line item${count === 1 ? "" : "s"} from the document.`
    );
  } catch (e: any) {
    toast.error(e?.message || "Could not read that document.");
  } finally {
    setExtracting(false);
  }
}
