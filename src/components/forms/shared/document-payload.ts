import { amountInWords } from "@/lib/format";

interface BuildDocumentPayloadArgs {
  referenceChallanNumber: string;
  referenceChallanDates: string[];
  documentNumber: string;
  poNumber: string;
  poDate: string;
  invoiceType: string;
  invoiceDate: string;
  customerId: string;
  customerName: string;
  customerGst: string | null;
  customerAddress: string | null;
  workOrder: string;
  deliveryMode: string;
  contactPerson: string;
  contactMobile: string;
  notes: string;
  status: "draft" | "sent";

  isChallan: boolean;
  isTaxInvoice: boolean;
  isIGST: boolean;

  challanNumber: string;
  challanDates: string[];
  movementReason: string;
  transporterName: string;
  placeOfDispatch: string;
  placeOfDelivery: string;

  totals: {
    net: number;
    disc: number;
    tax: number;
    subtotal: number;
    round_off: number;
    grand: number;
  };

  freight: number;
  packing: number;
  otherCharges: number;
  transportCharges: number;
  deliveryCharges: number;
  paymentTerms: string;
}

export function buildDocumentPayload({
  documentNumber,
  referenceChallanNumber,
  referenceChallanDates,
  poNumber,
  poDate,
  invoiceType,
  invoiceDate,
  customerId,
  customerName,
  customerGst,
  customerAddress,
  workOrder,
  deliveryMode,
  contactPerson,
  contactMobile,
  notes,
  status,
  isChallan,
  isTaxInvoice,
  isIGST,
  challanNumber,
  challanDates,
  movementReason,
  transporterName,
  placeOfDispatch,
  placeOfDelivery,
  totals,
  freight,
  packing,
  otherCharges,
  transportCharges,
  deliveryCharges,
  paymentTerms,
}: BuildDocumentPayloadArgs) {
  const sgst_amount = isIGST ? 0 : totals.tax / 2;
  const cgst_amount = isIGST ? 0 : totals.tax / 2;
  const igst_amount = isIGST ? totals.tax : 0;

  const payload: any = {
    invoice_type: invoiceType,
    invoice_date: invoiceDate,
    customer_id: customerId,
    customer_name_snapshot: customerName,
    customer_gst_snapshot: customerGst,
    customer_address_snapshot: customerAddress,
    work_order_number: workOrder || null,
    delivery_mode: deliveryMode || null,
    contact_person: contactPerson || null,
    contact_mobile: contactMobile || null,
    notes: notes || null,
    status,
  };

  // Manual numbering applies to Tax Invoices, Proforma Invoices,
  // and Quotations. Challan numbering remains unchanged.
  if (!isChallan) {
    payload.invoice_number = documentNumber.trim();
  }

  if (isChallan) {
    Object.assign(payload, {
      challan_number: challanNumber || null,
      challan_date: challanDates[0] || invoiceDate,
      challan_dates: challanDates.length
        ? challanDates
        : [invoiceDate],
      movement_reason: movementReason || null,
      transporter_name: transporterName.trim() || null,
      place_of_dispatch: placeOfDispatch.trim() || null,
      place_of_delivery: placeOfDelivery.trim() || null,
    });
  } else {
    Object.assign(payload, {
      is_igst: isIGST,
      net_value: totals.net,
      discount_amount: totals.disc,
      freight: Number(freight || 0),
      packing_charges: Number(packing || 0),
      other_charges: Number(otherCharges || 0),
      subtotal: totals.subtotal,
      sgst_amount,
      cgst_amount,
      igst_amount,
      round_off: totals.round_off,
      grand_total: totals.grand,
      amount_in_words: amountInWords(totals.grand),
      payment_terms: paymentTerms || null,
    });
    if (isTaxInvoice) {
      Object.assign(payload, {
        transportation_charges: Number(transportCharges || 0),
        delivery_charges: Number(deliveryCharges || 0),
        po_number: poNumber.trim() || null,
        po_date: poDate || null,
        reference_challan_number: referenceChallanNumber.trim() || null,
        reference_challan_date: referenceChallanDates[0] || null,
        reference_challan_dates: referenceChallanDates,
      });
    }
  }

  return payload;
}
