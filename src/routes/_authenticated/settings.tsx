import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InvoiceConfigurationTab } from "@/components/invoice-configuration-tab";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ABJAD ERP" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Configure invoice fields, company profile, and financial year." />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Invoice Configuration</TabsTrigger>
          <TabsTrigger value="company">Company Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="config"><InvoiceConfigurationTab /></TabsContent>
        <TabsContent value="company"><CompanyProfile /></TabsContent>
      </Tabs>
    </>
  );
}

type BankAccount = {
  id: string;
  company_profile_id: string;
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  branch_code: string | null;
  account_type: string | null;
  upi_id: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  notes: string | null;
};

const EMPTY_BANK_FORM = {
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  ifsc_code: "",
  branch_name: "",
  branch_code: "",
  account_type: "Current",
  upi_id: "",
  is_default: false,
  is_active: true,
  notes: "",
};

type BankForm = typeof EMPTY_BANK_FORM;


function CompanyProfile() {
  const qc = useQueryClient();

  const { data, isLoading: companyLoading } = useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_profile")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const {
    data: bankAccounts = [],
    isLoading: banksLoading,
    error: banksError,
  } = useQuery<BankAccount[]>({
    queryKey: ["company-bank-accounts"],
    enabled: !!data?.id,
    queryFn: async () => {
      const { data: accounts, error } = await (supabase as any)
        .from("company_bank_accounts")
        .select("*")
        .eq("company_profile_id", data!.id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (accounts ?? []) as BankAccount[];
    },
  });

  const [state, setState] = useState<any>({});
  const [bankForm, setBankForm] = useState<BankForm>({
    ...EMPTY_BANK_FORM,
  });
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankFormOpen, setBankFormOpen] = useState(false);

  useEffect(() => {
    if (data) setState(data);
  }, [data]);

  const resetBankForm = () => {
    setBankForm({ ...EMPTY_BANK_FORM });
    setEditingBankId(null);
    setBankFormOpen(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { id, created_at, updated_at, ...rest } = state;

      if (!rest.name?.trim()) {
        throw new Error("Please enter the company name.");
      }

      if (id) {
        const { error } = await supabase
          .from("company_profile")
          .update(rest)
          .eq("id", id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_profile")
          .insert(rest);

        if (error) throw error;
      }
    },

    onSuccess: () => {
      toast.success("Company profile saved successfully");
      qc.invalidateQueries({ queryKey: ["company"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const saveBankAccount = useMutation({
    mutationFn: async () => {
      if (!data?.id) {
        throw new Error("Save the company profile before adding bank accounts.");
      }

      if (!bankForm.bank_name.trim()) {
        throw new Error("Bank name is required.");
      }

      if (!bankForm.account_number.trim()) {
        throw new Error("Account number is required.");
      }

      if (!bankForm.ifsc_code.trim()) {
        throw new Error("IFSC code is required.");
      }

      // Only active accounts can be the default account.
      const shouldBeDefault = bankForm.is_active && bankForm.is_default;

      // Clear the previous default before assigning a new one.
      // The database allows only one default account per company.
      if (shouldBeDefault) {
        const { error } = await (supabase as any)
          .from("company_bank_accounts")
          .update({ is_default: false })
          .eq("company_profile_id", data.id);

        if (error) throw error;
      }

      const payload = {
        ...bankForm,
        bank_name: bankForm.bank_name.trim(),
        account_holder_name: bankForm.account_holder_name.trim() || null,
        account_number: bankForm.account_number.trim(),
        ifsc_code: bankForm.ifsc_code.trim().toUpperCase(),
        branch_name: bankForm.branch_name.trim() || null,
        branch_code: bankForm.branch_code.trim() || null,
        account_type: bankForm.account_type || null,
        upi_id: bankForm.upi_id.trim() || null,
        notes: bankForm.notes.trim() || null,
        is_default: shouldBeDefault,
        company_profile_id: data.id,
      };

      if (editingBankId) {
        const { error } = await (supabase as any)
          .from("company_bank_accounts")
          .update(payload)
          .eq("id", editingBankId)
          .eq("company_profile_id", data.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("company_bank_accounts")
          .insert({
            ...payload,
            display_order: bankAccounts.length,
          });

        if (error) throw error;
      }
    },

    onSuccess: () => {
      toast.success(
        editingBankId
          ? "Bank account updated successfully"
          : "Bank account added successfully",
      );

      resetBankForm();
      qc.invalidateQueries({ queryKey: ["company-bank-accounts"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBankAccount = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await (supabase as any)
        .from("company_bank_accounts")
        .delete()
        .eq("id", accountId)
        .eq("company_profile_id", data!.id);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Bank account deleted");
      qc.invalidateQueries({ queryKey: ["company-bank-accounts"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const editBankAccount = (account: BankAccount) => {
    setEditingBankId(account.id);

    setBankForm({
      bank_name: account.bank_name ?? "",
      account_holder_name: account.account_holder_name ?? "",
      account_number: account.account_number ?? "",
      ifsc_code: account.ifsc_code ?? "",
      branch_name: account.branch_name ?? "",
      branch_code: account.branch_code ?? "",
      account_type: account.account_type ?? "Current",
      upi_id: account.upi_id ?? "",
      is_default: account.is_default,
      is_active: account.is_active,
      notes: account.notes ?? "",
    });

    setBankFormOpen(true);
  };

  const setField =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setState((s: any) => ({ ...s, [k]: e.target.value }));

  const field = (
    k: string,
    label: string,
    type: string = "text",
    full = false,
  ) => (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs" htmlFor={`cp-${k}`}>
        {label}
      </Label>
      <Input
        id={`cp-${k}`}
        type={type}
        value={state[k] ?? ""}
        onChange={setField(k)}
      />
    </div>
  );

  const bankField = (
    key: keyof BankForm,
    label: string,
    placeholder = "",
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={String(bankForm[key] ?? "")}
        placeholder={placeholder}
        onChange={(e) =>
          setBankForm((prev) => ({
            ...prev,
            [key]: e.target.value,
          }))
        }
      />
    </div>
  );

  if (companyLoading) {
    return <div className="text-sm text-muted-foreground">Loading company profile…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Profile</CardTitle>
          <CardDescription>
            Company details displayed on invoices, quotations and other documents.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 sm:grid-cols-2">
          {field("name", "Company Name")}
          {field("website", "Website")}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Address</Label>
            <Textarea
              rows={2}
              value={state.address ?? ""}
              onChange={setField("address")}
            />
          </div>

          {field("city", "City")}
          {field("pincode", "Pincode")}
          {field("state", "State")}
          {field("state_code", "State Code")}
          {field("gst_number", "GST Number")}
          {field("pan_number", "PAN Number")}
          {field("mobile", "Mobile")}
          {field("alt_mobile", "Alt Mobile")}
          {field("email", "Email", "email")}
          {field("financial_year", "Financial Year")}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Declaration</Label>
            <Textarea
              rows={3}
              value={state.declaration ?? ""}
              onChange={setField("declaration")}
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving…" : "Save Company Profile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Company Bank Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Company Bank Accounts</CardTitle>
            <CardDescription>
              Manage the bank accounts used on customer invoices. Assign an account
              to each customer from the Customers section.
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={() => {
              resetBankForm();
              setBankFormOpen(true);
            }}
            disabled={!data?.id}
          >
            + Add Bank Account
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {!data?.id && (
            <p className="text-sm text-muted-foreground">
              Save your company profile before adding bank accounts.
            </p>
          )}

          {banksLoading && (
            <p className="text-sm text-muted-foreground">
              Loading bank accounts…
            </p>
          )}

          {banksError && (
            <p className="text-sm text-destructive">
              Could not load bank accounts: {(banksError as Error).message}
            </p>
          )}

          {!banksLoading && !banksError && bankAccounts.length === 0 && data?.id && (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="font-medium">No bank accounts added</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your company bank account details to use them on invoices.
              </p>
            </div>
          )}

          {bankAccounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    {account.bank_name || "Unnamed Bank"}
                  </span>

                  {account.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Default
                    </span>
                  )}

                  {!account.is_active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  {account.account_holder_name || "Account holder not specified"}
                </p>

                <div className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>
                    <strong className="text-foreground">Account:</strong>{" "}
                    {account.account_number || "—"}
                  </span>
                  <span>
                    <strong className="text-foreground">IFSC:</strong>{" "}
                    {account.ifsc_code || "—"}
                  </span>
                  <span>
                    <strong className="text-foreground">Branch:</strong>{" "}
                    {account.branch_name || "—"}
                  </span>
                  <span>
                    <strong className="text-foreground">Account type:</strong>{" "}
                    {account.account_type || "—"}
                  </span>
                  {account.upi_id && (
                    <span>
                      <strong className="text-foreground">UPI:</strong>{" "}
                      {account.upi_id}
                    </span>
                  )}
                </div>

                {account.notes && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    {account.notes}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {!account.is_default && account.is_active && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saveBankAccount.isPending}
                    onClick={() => {
                      setBankForm({
                        ...EMPTY_BANK_FORM,
                        is_default: true,
                      });
                      setEditingBankId(account.id);

                      const updatedForm: BankForm = {
                        bank_name: account.bank_name ?? "",
                        account_holder_name: account.account_holder_name ?? "",
                        account_number: account.account_number ?? "",
                        ifsc_code: account.ifsc_code ?? "",
                        branch_name: account.branch_name ?? "",
                        branch_code: account.branch_code ?? "",
                        account_type: account.account_type ?? "Current",
                        upi_id: account.upi_id ?? "",
                        is_default: true,
                        is_active: account.is_active,
                        notes: account.notes ?? "",
                      };

                      setBankForm(updatedForm);
                      saveBankAccount.mutate();
                    }}
                  >
                    Set Default
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => editBankAccount(account)}
                >
                  Edit
                </Button>

                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleteBankAccount.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete the bank account "${account.bank_name}"? Customers assigned to it will have no bank account assigned.`,
                      )
                    ) {
                      deleteBankAccount.mutate(account.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}

          {/* Add / Edit Bank Account Form */}
          {bankFormOpen && (
            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
              <div>
                <h3 className="font-semibold">
                  {editingBankId ? "Edit Bank Account" : "Add Bank Account"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Enter the bank details exactly as registered with your bank.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {bankField("bank_name", "Bank Name", "e.g. HDFC Bank")}
                {bankField("account_holder_name", "Account Holder Name")}
                {bankField("account_number", "Account Number")}
                {bankField("ifsc_code", "IFSC Code", "e.g. HDFC0001234")}
                {bankField("branch_name", "Branch Name")}
                {bankField("branch_code", "Branch Code")}
                {bankField("upi_id", "UPI ID", "name@bank")}

                <div className="space-y-1.5">
                  <Label className="text-xs">Account Type</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={bankForm.account_type}
                    onChange={(e) =>
                      setBankForm((prev) => ({
                        ...prev,
                        account_type: e.target.value,
                      }))
                    }
                  >
                    <option value="Current">Current</option>
                    <option value="Savings">Savings</option>
                    <option value="Cash Credit">Cash Credit</option>
                    <option value="Overdraft">Overdraft</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={2}
                    value={bankForm.notes}
                    onChange={(e) =>
                      setBankForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bankForm.is_default}
                    onChange={(e) =>
                      setBankForm((prev) => ({
                        ...prev,
                        is_default: e.target.checked,
                      }))
                    }
                  />
                  Set as default account
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bankForm.is_active}
                    onChange={(e) =>
                      setBankForm((prev) => ({
                        ...prev,
                        is_active: e.target.checked,
                        is_default: e.target.checked ? prev.is_default : false,
                      }))
                    }
                  />
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={resetBankForm}
                  disabled={saveBankAccount.isPending}
                >
                  Cancel
                </Button>

                <Button
                  onClick={() => saveBankAccount.mutate()}
                  disabled={saveBankAccount.isPending}
                >
                  {saveBankAccount.isPending
                    ? "Saving…"
                    : editingBankId
                      ? "Update Bank Account"
                      : "Add Bank Account"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
