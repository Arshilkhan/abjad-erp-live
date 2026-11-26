import type { SalesDocumentKind } from "@/lib/sales-documents";

export interface DocumentFormConfig {
  kind: SalesDocumentKind;
  label: string;
  isTaxInvoice: boolean;
  isChallan: boolean;
  isNote: boolean;
  showPaymentTerms: boolean;
  showTransportDetails: boolean;
  showPricing: boolean;
  showTaxes: boolean;
}

export const DOCUMENT_FORM_CONFIG: Record<
  SalesDocumentKind,
  DocumentFormConfig
> = {
  tax_invoice: {
    kind: "tax_invoice",
    label: "Tax Invoice",
    isTaxInvoice: true,
    isChallan: false,
    isNote: false,
    showPaymentTerms: true,
    showTransportDetails: false,
    showPricing: true,
    showTaxes: true,
  },
  proforma: {
    kind: "proforma",
    label: "Proforma Invoice",
    isTaxInvoice: false,
    isChallan: false,
    isNote: false,
    showPaymentTerms: true,
    showTransportDetails: false,
    showPricing: true,
    showTaxes: true,
  },
  quotation: {
    kind: "quotation",
    label: "Quotation",
    isTaxInvoice: false,
    isChallan: false,
    isNote: false,
    showPaymentTerms: true,
    showTransportDetails: false,
    showPricing: true,
    showTaxes: true,
  },
  delivery_challan: {
    kind: "delivery_challan",
    label: "Delivery Challan",
    isTaxInvoice: false,
    isChallan: true,
    isNote: false,
    showPaymentTerms: false,
    showTransportDetails: true,
    showPricing: false,
    showTaxes: false,
  },
  credit_note: {
    kind: "credit_note",
    label: "Credit Note",
    isTaxInvoice: false,
    isChallan: false,
    isNote: true,
    showPaymentTerms: true,
    showTransportDetails: false,
    showPricing: true,
    showTaxes: true,
  },
  debit_note: {
    kind: "debit_note",
    label: "Debit Note",
    isTaxInvoice: false,
    isChallan: false,
    isNote: true,
    showPaymentTerms: true,
    showTransportDetails: false,
    showPricing: true,
    showTaxes: true,
  },
};

export function getDocumentFormConfig(
  kind: SalesDocumentKind,
): DocumentFormConfig {
  return DOCUMENT_FORM_CONFIG[kind];
}