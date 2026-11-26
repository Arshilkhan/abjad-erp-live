
import { computeItem, type LineItem } from "./types";

export function buildDocumentItemRows(
  items: LineItem[],
  invoiceId: string,
  isChallan: boolean,
) {
  return items.map((it) => {
    const c = computeItem(it);

    const base = {
      invoice_id: invoiceId,
      sr_no: it.sr_no,
      product_id: it.product_id,
      hsn_code: it.hsn_code || null,
      description: it.description,
      quantity: it.quantity,
      uom: it.uom,
      serial_batch_number: it.serial_batch_number?.trim() || null,
    };

    return isChallan
      ? base
      : {
          ...base,
          unit_rate: it.unit_rate,
          discount_pct: c.discount_pct,
          discount_amount: c.discount_amount,
          tax_pct: it.tax_pct,
          tax_amount: c.tax_amount,
          total_amount: c.total_amount,
        };
  });
}
