
import { supabase } from "@/integrations/supabase/client";
import { computeItem, type LineItem } from "@/components/forms/shared/types";
import type { Json } from "@/integrations/supabase/types";

interface BulkInvoiceData {
    invoice_number: string;
    invoice_date: string;
    customer_id: string;
    customer_name_snapshot: string;
    customer_gst_snapshot: string | null;
    customer_address_snapshot: string | null;
    po_number?: string | null;
    po_date?: string | null;
    work_order_number?: string | null;
    is_igst: boolean;
    net_value: number;
    discount_amount: number;
    freight: number;
    packing_charges: number;
    other_charges: number;
    subtotal: number;
    sgst_amount: number;
    cgst_amount: number;
    igst_amount: number;
    round_off: number;
    grand_total: number;
    amount_in_words?: string | null;
    delivery_mode?: string | null;
    payment_terms?: string | null;
    contact_person?: string | null;
    contact_mobile?: string | null;
    notes?: string | null;
    transportation_charges: number;
    delivery_charges: number;
    reference_challan_number?: string | null;
    reference_challan_date?: string | null;
    reference_challan_dates?: string[];
}

export async function saveBulkImportedInvoice(
    invoice: BulkInvoiceData,
    items: LineItem[],
) {
    if (!invoice.invoice_number.trim()) {
        throw new Error("Invoice number is required.");
    }
    if (!invoice.invoice_date) {
        throw new Error("Invoice date is required.");
    }
    if (!invoice.customer_id) {
        throw new Error("Select or create a customer first.");
    }
    if (!items.length) {
        throw new Error("At least one invoice item is required.");
    }

    const itemPayload = items.map((item, index) => ({
        sr_no: index + 1,
        product_id: item.product_id,
        hsn_code: item.hsn_code || null,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom || "PCS",
        unit_rate: item.unit_rate,
        discount_pct: computeItem(item).discount_pct,
        tax_pct: item.tax_pct,
        serial_batch_number: item.serial_batch_number || null,
    }));

    const { data, error } = await supabase.rpc(
        "bulk_import_tax_invoice",
        {
            p_invoice: invoice as unknown as Json,
            p_items: itemPayload as unknown as Json,
        },
    );

    if (error) {
        if (
            error.code === "23505" ||
            error.message.toLowerCase().includes("already exists")
        ) {
            throw new Error(
                `Invoice number ${invoice.invoice_number} already exists.`,
            );
        }

        throw error;
    }
    return data as string;
}
