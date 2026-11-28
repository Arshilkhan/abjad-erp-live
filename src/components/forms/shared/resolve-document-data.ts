
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LineItem } from "./types";

interface ResolveCustomerArgs {
  supabase: SupabaseClient;
  customer: any;
  customers: any[];
  customerText: string;
  custCompany: string;
  custAddress: string;
  custMobile: string;
  custEmail: string;
  custGst: string;
  createdBy?: string;
}

export async function resolveCustomer({
  supabase,
  customer,
  customers,
  customerText,
  custCompany,
  custAddress,
  custMobile,
  custEmail,
  custGst,
  createdBy,
}: ResolveCustomerArgs) {
  const nameTyped = customerText.trim();

  let cust: any =
    customer ??
    customers.find(
      (c: any) =>
        (c.customer_name ?? "").toLowerCase() === nameTyped.toLowerCase() ||
        (c.company_name ?? "").toLowerCase() === nameTyped.toLowerCase(),
    );

  if (cust) {
    const patch: Record<string, any> = {};

    if (custCompany.trim() && custCompany !== (cust.company_name ?? "")) {
      patch.company_name = custCompany.trim();
    }

    if (nameTyped && nameTyped !== (cust.contact_person ?? "")) {
      patch.contact_person = nameTyped;
    }

    if (custAddress.trim() && custAddress !== (cust.billing_address ?? "")) {
      patch.billing_address = custAddress.trim();
    }

    if (custMobile.trim() && custMobile !== (cust.mobile ?? "")) {
      patch.mobile = custMobile.trim();
    }

    if (custEmail.trim() && custEmail !== (cust.email ?? "")) {
      patch.email = custEmail.trim();
    }

    if (custGst.trim() && custGst !== (cust.gst_number ?? "")) {
      patch.gst_number = custGst.trim();
    }

    if (Object.keys(patch).length) {
      const { data, error } = await supabase
        .from("customers")
        .update(patch)
        .eq("id", cust.id)
        .select("*")
        .single();

      if (error) throw error;
      cust = {
        ...data,
        bank_account_id: data.bank_account_id ?? cust.bank_account_id ?? null,
      };
    } else {
      cust = {
        ...cust,
        bank_account_id: cust.bank_account_id ?? null,
      };
    }
  } else {
    const { data, error } = await supabase
      .from("customers")
      .insert({
        customer_name: nameTyped,
        company_name: custCompany.trim() || null,
        contact_person: nameTyped || null,
        billing_address: custAddress.trim() || null,
        mobile: custMobile.trim() || null,
        email: custEmail.trim() || null,
        gst_number: custGst.trim() || null,
        bank_account_id: null,
        created_by: createdBy ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;

    cust = {
      ...data,
      bank_account_id: data.bank_account_id ?? null,
    };
  }

  return cust;
}

interface ResolveProductsArgs {
  supabase: SupabaseClient;
  items: LineItem[];
  productTexts: string[];
  products: any[];
}

export async function resolveProducts({
  supabase,
  items,
  productTexts,
  products,
}: ResolveProductsArgs): Promise<LineItem[]> {
  const resolvedItems: LineItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const typed = (productTexts[i] ?? "").trim();

    if (it.product_id || !typed) {
      resolvedItems.push({
        ...it,
        description: it.description || typed,
      });
      continue;
    }

    const match = products.find(
      (p: any) =>
        (p.product_name ?? "").toLowerCase() === typed.toLowerCase(),
    );

    if (match) {
      resolvedItems.push({
        ...it,
        product_id: match.id,
        description: it.description || typed,
      });
      continue;
    }

    const { data: newProd, error: pErr } = await supabase
      .from("products")
      .insert({
        product_name: typed,
        hsn_code: it.hsn_code || null,
        description: it.description || null,
        unit: it.uom || null,
        selling_price: Number(it.unit_rate) || 0,
        gst_percentage: Number(it.tax_pct) || 0,
        stock_quantity: Number(it.quantity) || 0,
      })
      .select()
      .single();

    if (pErr) throw pErr;

    resolvedItems.push({
      ...it,
      product_id: newProd.id,
      description: it.description || typed,
    });
  }

  return resolvedItems;
}
