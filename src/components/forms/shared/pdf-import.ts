import type { Dispatch, SetStateAction } from "react";

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
  items: Array<{
    description: string;
    hsn_code?: string;
    quantity: number;
    uom: string;
    unit_rate: number;
    discount_pct?: number;
    tax_pct?: number;
  }>;
  po_number?: string;
  po_date?: string;
}

interface ImportPdfArgs {
  file: File;
  runExtract: (args: {
    data: {
      fileData: string;
      fileName: string;
    };
  }) => Promise<PdfImportData>;
  customers: any[];
  products: any[];
  isTaxInvoice: boolean;
  setPdfName: Dispatch<SetStateAction<string>>;
  setCustAddress: Dispatch<SetStateAction<string>>;
  setPdfImported: Dispatch<SetStateAction<boolean>>;
  setExtracting: Dispatch<SetStateAction<boolean>>;
  setCustomerId: Dispatch<SetStateAction<string>>;
  setCustomerText: Dispatch<SetStateAction<string>>;
  setCustCompany: Dispatch<SetStateAction<string>>;
  setCustMobile: Dispatch<SetStateAction<string>>;
  setCustEmail: Dispatch<SetStateAction<string>>;
  setCustGst: Dispatch<SetStateAction<string>>;
  setDocumentNumber: Dispatch<SetStateAction<string>>;
  setInvoiceDate: Dispatch<SetStateAction<string>>;
  setWorkOrder: Dispatch<SetStateAction<string>>;
  setFreight: Dispatch<SetStateAction<number>>;
  setPacking: Dispatch<SetStateAction<number>>;
  setOtherCharges: Dispatch<SetStateAction<number>>;
  setDeliveryMode: Dispatch<SetStateAction<string>>;
  setPaymentTerms: Dispatch<SetStateAction<string>>;
  setNotes: Dispatch<SetStateAction<string>>;
  setItems: Dispatch<SetStateAction<any[]>>;
  setProductTexts: Dispatch<SetStateAction<string[]>>;
  setPoNumber: Dispatch<SetStateAction<string>>;
  setPoDate: Dispatch<SetStateAction<string>>;
  toast: {
    error: (message: string) => unknown;
    success: (message: string) => unknown;
  };
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
  toast,
}: ImportPdfArgs) {

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!["pdf", "doc", "docx"].includes(extension ?? "")) {
    return toast.error("Please choose a PDF, DOC, or DOCX file.");
  }

  if (file.size > 15 * 1024 * 1024) {
    return toast.error("Document is too large (max 15 MB).");
  }

  setPdfName(file.name);
  setPdfImported(false);
  setExtracting(true);

  try {
    const fileData = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("Could not read that file."));
      r.readAsDataURL(file);
    });

    const d = await runExtract({
      data: {
        fileData,
        fileName: file.name,
      },
    });

    if (d.customer_name) {
      const customerName = d.customer_name.toLowerCase();
      const match = customers.find(
        (c: any) =>
          (c.customer_name ?? "").toLowerCase() === customerName ||
          (c.company_name ?? "").toLowerCase() === customerName,
      );
      setCustomerId(match?.id ?? "");
      setCustomerText(d.customer_name);
    }

    if (d.customer_name || d.company_name) {
      setCustCompany(d.customer_name || d.company_name || "");
    }
    if (d.po_number) setPoNumber(d.po_number);
    if (d.po_date) setPoDate(d.po_date);

    const footerMobiles =
      (d.footer_contact_mobiles ?? []).length > 0
        ? d.footer_contact_mobiles!.join(" / ")
        : "";

    if (footerMobiles && !d.mobile) {
      setCustMobile(footerMobiles);
    }

    if (d.email) setCustEmail(d.email);
    if (d.gst_number) setCustGst(d.gst_number);
    if (d.invoice_date) setInvoiceDate(d.invoice_date);
    if (d.work_order_number) setWorkOrder(d.work_order_number);

    if (isTaxInvoice && d.freight) setFreight(d.freight);
    if (isTaxInvoice && d.packing_charges) setPacking(d.packing_charges);
    if (isTaxInvoice && d.other_charges) setOtherCharges(d.other_charges);

    if (d.delivery_mode) setDeliveryMode(d.delivery_mode);
    if (d.payment_terms) setPaymentTerms(d.payment_terms);
    if (d.notes) setNotes(d.notes);
    if (d.invoice_number) {
      setDocumentNumber(d.invoice_number);
    }
    if (d.customer_address) {
      setCustAddress(d.customer_address);
    }

    if (d.items.length) {
      setItems(
        d.items.map((it, i) => ({
          sr_no: i + 1,
          product_id:
            products.find(
              (p: any) =>
                (p.product_name ?? "").toLowerCase() ===
                it.description.toLowerCase(),
            )?.id ?? null,
          hsn_code: it.hsn_code,
          description: it.description,
          quantity: it.quantity,
          uom: it.uom,
          unit_rate: it.unit_rate,
          discount_mode: "pct" as const,
          discount_value: Number(it.discount_pct ?? 0),
          tax_pct: it.tax_pct || 18,
          serial_batch_number: "",
        })),
      );

      setProductTexts(d.items.map((it) => it.description));
    }

    setPdfImported(true);

    toast.success(
      `Imported ${d.items.length} line item${d.items.length === 1 ? "" : "s"} from the document.`
    );
  } catch (e: any) {
    toast.error(e?.message || "Could not read that document.");
  } finally {
    setExtracting(false);
  }
}
