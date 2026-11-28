
import {
  salesDocumentConfig,
  isSalesDocumentKind,
  type SalesDocumentKind,
} from "./sales-documents";

export async function fetchSalesDocument(
  supabase: any,
  id: string,
  kind?: string,
) {
  const k: SalesDocumentKind =
    kind && isSalesDocumentKind(kind) ? kind : "tax_invoice";

  const cfg = salesDocumentConfig(k);

  const { data: invoice, error } = await supabase
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return null;
  }

  const [
    { data: items, error: itemsError },
    { data: company, error: companyError },
  ] = await Promise.all([
    supabase
      .from(cfg.itemsTable)
      .select("*")
      .eq("invoice_id", id)
      .order("sr_no", { ascending: true }),

    supabase
      .from("company_profile")
      .select("*")
      .limit(1)
      .maybeSingle(),
  ]);

  if (itemsError) throw itemsError;
  if (companyError) throw companyError;

  let customerBankAccount = null;

  if (k !== "delivery_challan" && invoice.customer_id) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("bank_account_id")
      .eq("id", invoice.customer_id)
      .maybeSingle();

    if (customerError) throw customerError;

    if (customer?.bank_account_id) {
      const { data: bankAccount, error: bankError } = await supabase
        .from("company_bank_accounts")
        .select(
          "id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, branch_code, upi_id",
        )
        .eq("id", customer.bank_account_id)
        .eq("is_active", true)
        .maybeSingle();

      if (bankError) throw bankError;

      customerBankAccount = bankAccount;
    }
  }

  return {
    kind: k,
    invoice,
    items: items ?? [],
    company: company ?? null,
    customerBankAccount,
  };
}
