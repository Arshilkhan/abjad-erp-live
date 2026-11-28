import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFinancialYears, type FinancialYear } from "@/components/reports/shared/useFinancialYears";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — ABJAD ERP" }] }),
  component: CustomersPage,
});

type CustomerRow = Tables<"customers"> & {
  bank_account_id: string | null;
};

type BankAccount = {
  id: string;
  bank_name: string | null;
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  is_active: boolean;
  is_default: boolean;
  display_order: number;
};

const EMPTY_FORM = {
  customer_name: "",
  company_name: "",
  billing_address: "",
  shipping_address: "",
  contact_person: "",
  mobile: "",
  email: "",
  gst_number: "",
  pan_number: "",
  state: "Maharashtra",
  state_code: "27",
  place_of_supply: "Maharashtra",
  credit_limit: 0,
  payment_terms: "30 Days",
  notes: "",
  bank_account_id: "",
};

type CustomerForm = typeof EMPTY_FORM;
type FormKey = keyof CustomerForm;

const INPUT_FIELDS: ReadonlyArray<{ key: FormKey; label: string; type?: string }> = [
  { key: "customer_name", label: "Customer Name *" },
  { key: "company_name", label: "Company Name" },
  { key: "contact_person", label: "Contact Person" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "gst_number", label: "GST Number" },
  { key: "pan_number", label: "PAN Number" },
  { key: "state", label: "State" },
  { key: "state_code", label: "State Code" },
  { key: "place_of_supply", label: "Place of Supply" },
  { key: "credit_limit", label: "Credit Limit (₹)", type: "number" },
  { key: "payment_terms", label: "Payment Terms" },
];

const TEXTAREA_FIELDS: ReadonlyArray<{ key: FormKey; label: string }> = [
  { key: "billing_address", label: "Billing Address" },
  { key: "shipping_address", label: "Shipping Address" },
  { key: "notes", label: "Notes" },
];

const OPENING_BALANCE_PATTERN = /^-?\d{1,12}(\.\d{1,2})?$/;
const OPENING_BALANCE_TYPING = /^-?\d*\.?\d{0,2}$/;

const isValidOpeningBalance = (value: string) => OPENING_BALANCE_PATTERN.test(value.trim());

const pickDefaultYear = (years: FinancialYear[]) => years.find((year) => year.is_active) ?? years[0];

interface OpeningBalanceSectionProps {
  financialYears: FinancialYear[];
  financialYearsLoading: boolean;
  yearId: string;
  onYearChange: (id: string) => void;
  input: string;
  onInputChange: (value: string) => void;
  balanceLoading: boolean;
  hasSelectedYear: boolean;
  saving: boolean;
  onSave: () => void;
}

const OpeningBalanceSection = memo(function OpeningBalanceSection({
  financialYears,
  financialYearsLoading,
  yearId,
  onYearChange,
  input,
  onInputChange,
  balanceLoading,
  hasSelectedYear,
  saving,
  onSave,
}: OpeningBalanceSectionProps) {
  return (
    <div className="sm:col-span-2 space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Customer Opening Balance</h3>
        <p className="text-xs text-muted-foreground">
          Set the opening balance separately for each financial year. Positive means the customer owes us; negative
          means an advance or credit.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Financial Year</Label>
          <Select
            value={yearId}
            onValueChange={onYearChange}
            disabled={financialYearsLoading || !financialYears.length}
          >
            <SelectTrigger>
              <SelectValue placeholder={financialYearsLoading ? "Loading financial years…" : "Select financial year"} />
            </SelectTrigger>
            <SelectContent>
              {financialYears.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.year_label}
                  {year.is_active ? " (Current)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Op. bal (₹)</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={input}
            onChange={(e) => {
              const value = e.target.value;
              if (OPENING_BALANCE_TYPING.test(value)) onInputChange(value);
            }}
            disabled={balanceLoading || !hasSelectedYear}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || balanceLoading || !hasSelectedYear || !isValidOpeningBalance(input)}
        >
          {saving ? "Saving…" : "Save Opening Balance"}
        </Button>
      </div>
    </div>
  );
});
const CustomerTableRow = memo(function CustomerTableRow({
  row,
  onEdit,
  onDelete,
}: {
  row: CustomerRow;
  onEdit: (row: CustomerRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.customer_name}</div>
        <div className="text-xs text-muted-foreground">{row.company_name}</div>
      </TableCell>
      <TableCell>
        <div className="text-sm">{row.contact_person ?? "—"}</div>
        <div className="text-xs text-muted-foreground">
          {row.mobile} {row.email && `• ${row.email}`}
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{row.gst_number ?? "—"}</TableCell>
      <TableCell>
        <span className="text-sm">{row.state}</span>{" "}
        <span className="text-xs text-muted-foreground">({row.state_code})</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatINR(row.credit_limit)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button size="icon" variant="ghost" onClick={() => onEdit(row)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => confirm("Delete this customer?") && onDelete(row.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>({ ...EMPTY_FORM });

  // Keeps typing responsive: the table filters one render behind the input.
  const deferredSearch = useDeferredValue(search);

  const { financialYears, isLoading: financialYearsLoading } = useFinancialYears();
  const {
    data: bankAccounts = [],
    isLoading: bankAccountsLoading,
    error: bankAccountsError,
  } = useQuery<BankAccount[]>({
    queryKey: ["company-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("company_bank_accounts")
        .select(`
        id,
        bank_name,
        account_holder_name,
        account_number,
        ifsc_code,
        branch_name,
        is_active,
        is_default,
        display_order
      `)
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("bank_name", { ascending: true });

      if (error) throw error;

      return (data ?? []) as BankAccount[];
    },
  });
  const selectedBankAccount = bankAccounts.find(
    (account) => account.id === form.bank_account_id,
  );
  const [openingBalanceYearId, setOpeningBalanceYearId] = useState("");
  const [openingBalanceInput, setOpeningBalanceInput] = useState("0");

  useEffect(() => {
    if (!financialYears.length || openingBalanceYearId) return;
    setOpeningBalanceYearId(pickDefaultYear(financialYears).id);
  }, [financialYears, openingBalanceYearId]);

  const selectedOpeningBalanceYear = useMemo(
    () => financialYears.find((year) => year.id === openingBalanceYearId),
    [financialYears, openingBalanceYearId],
  );

  const { data: rows = [], isLoading } = useQuery<CustomerRow[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as CustomerRow[];
    },
  });

  const { data: existingOpeningBalance, isLoading: openingBalanceLoading } = useQuery({
    queryKey: ["customer-opening-balance", editingId, selectedOpeningBalanceYear?.year_label],
    enabled: Boolean(editingId && selectedOpeningBalanceYear),
    queryFn: async () => {
      if (!editingId || !selectedOpeningBalanceYear) return null;

      const { data, error } = await supabase
        .from("customer_opening_balances")
        .select("opening_balance")
        .eq("customer_id", editingId)
        .eq("financial_year", selectedOpeningBalanceYear.year_label)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!editingId || !selectedOpeningBalanceYear) return;
    setOpeningBalanceInput(String(existingOpeningBalance?.opening_balance ?? "0"));
  }, [editingId, selectedOpeningBalanceYear?.year_label, existingOpeningBalance]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        credit_limit: Number(form.credit_limit) || 0,
        bank_account_id: form.bank_account_id || null,
      };

      const customersTable = (supabase as any).from("customers");

      if (editingId) {
        const { error } = await customersTable
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await customersTable.insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Customer updated" : "Customer added");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveOpeningBalance = useMutation({
    mutationFn: async () => {
      if (!editingId) {
        throw new Error("Save the customer before adding an opening balance.");
      }

      if (!selectedOpeningBalanceYear || !financialYears.some((year) => year.id === openingBalanceYearId)) {
        throw new Error("Please select a valid financial year.");
      }

      const value = openingBalanceInput.trim();

      if (!OPENING_BALANCE_PATTERN.test(value)) {
        throw new Error("Enter a valid amount with up to 12 digits and 2 decimal places.");
      }

      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        throw new Error("Enter a valid opening balance.");
      }

      const { error } = await supabase.from("customer_opening_balances").upsert(
        {
          customer_id: editingId,
          financial_year: selectedOpeningBalanceYear.year_label,
          opening_balance: amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "customer_id,financial_year" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opening balance saved");
      qc.invalidateQueries({ queryKey: ["customer-opening-balance", editingId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save opening balance");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const searchIndex = useMemo(
    () =>
      rows.map((r) =>
        [r.customer_name, r.company_name, r.gst_number, r.mobile, r.email].filter(Boolean).join("\n").toLowerCase(),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    if (!deferredSearch) return rows;
    const term = deferredSearch.toLowerCase();
    return rows.filter((_, i) => searchIndex[i].includes(term));
  }, [rows, searchIndex, deferredSearch]);

  const setField = useCallback((key: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openEdit = useCallback(
    (row: CustomerRow) => {
      setEditingId(row.id);
      setForm({ ...EMPTY_FORM, ...row, credit_limit: row.credit_limit ?? 0 } as CustomerForm);
      setOpeningBalanceYearId(pickDefaultYear(financialYears)?.id ?? "");
      setOpeningBalanceInput("0");
      setOpen(true);
    },
    [financialYears],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        resetForm();
        setOpeningBalanceInput("0");
        setOpeningBalanceYearId("");
      }
    },
    [resetForm],
  );

  const handleDelete = useCallback((id: string) => remove.mutate(id), [remove.mutate]);
  const saveOpeningBalanceNow = useCallback(() => saveOpeningBalance.mutate(), [saveOpeningBalance.mutate]);

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${rows.length} customer${rows.length === 1 ? "" : "s"} in your directory.`}
        actions={
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" /> New Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden p-0">
              <DialogHeader className="shrink-0 border-b px-6 py-4">
                <DialogTitle>
                  {editingId ? "Edit Customer" : "New Customer"}
                </DialogTitle>
              </DialogHeader>

              {/* Single scrollable content area */}
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                {/* Customer Details */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {([
                    ["customer_name", "Customer Name *"],
                    ["company_name", "Company Name"],
                    ["contact_person", "Contact Person"],
                    ["mobile", "Mobile"],
                    ["email", "Email"],
                    ["gst_number", "GST Number"],
                    ["pan_number", "PAN Number"],
                    ["state", "State"],
                    ["state_code", "State Code"],
                    ["place_of_supply", "Place of Supply"],
                    ["credit_limit", "Credit Limit (₹)", "number"],
                    ["payment_terms", "Payment Terms"],
                  ] as const).map(([k, label, type]) => (
                    <div key={k} className="min-w-0 space-y-1.5">
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type={type ?? "text"}
                        className="w-full"
                        value={(form as any)[k] ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [k]: e.target.value })
                        }
                      />
                    </div>
                  ))}

                  {/* Company Bank Account */}
                  <div className="min-w-0 space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Company Bank Account</Label>

                    <Select
                      value={form.bank_account_id || "__none__"}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          bank_account_id: value === "__none__" ? "" : value,
                        })
                      }
                      disabled={bankAccountsLoading}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue
                          placeholder={
                            bankAccountsLoading
                              ? "Loading bank accounts..."
                              : "Select company bank account"
                          }
                        />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="__none__">
                          No bank account assigned
                        </SelectItem>

                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.bank_name || "Unnamed Bank"}
                            {account.is_default ? " (Default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedBankAccount && (
                      <p className="text-xs text-muted-foreground">
                        {selectedBankAccount.account_number
                          ? `A/C: ${selectedBankAccount.account_number}`
                          : "Account number not provided"}
                        {selectedBankAccount.branch_name
                          ? ` • ${selectedBankAccount.branch_name}`
                          : ""}
                        {selectedBankAccount.ifsc_code
                          ? ` • IFSC: ${selectedBankAccount.ifsc_code}`
                          : ""}
                      </p>
                    )}

                    {bankAccountsError && (
                      <p className="text-xs text-destructive">
                        Failed to load bank accounts: {(bankAccountsError as Error).message}
                      </p>
                    )}

                    {!bankAccountsLoading &&
                      !bankAccountsError &&
                      bankAccounts.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No active bank accounts found. Add one in Company Profile settings.
                        </p>
                      )}
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Billing Address</Label>
                    <Textarea
                      rows={2}
                      className="w-full resize-y"
                      value={form.billing_address}
                      onChange={(e) =>
                        setForm({ ...form, billing_address: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Shipping Address</Label>
                    <Textarea
                      rows={2}
                      className="w-full resize-y"
                      value={form.shipping_address}
                      onChange={(e) =>
                        setForm({ ...form, shipping_address: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Notes</Label>
                    <Textarea
                      rows={2}
                      className="w-full resize-y"
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Customer Opening Balance */}
                {editingId && (
                  <div className="mt-6 w-full space-y-4 rounded-lg border bg-muted/20 p-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">
                        Customer Opening Balance
                      </h3>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Set the opening balance separately for each financial year.
                        A positive balance means the customer owes us; a negative
                        balance represents an advance or credit.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Financial Year */}
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs">Financial Year</Label>

                        <Select
                          value={openingBalanceYearId}
                          onValueChange={setOpeningBalanceYearId}
                          disabled={
                            financialYearsLoading || !financialYears.length
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                financialYearsLoading
                                  ? "Loading financial years..."
                                  : "Select financial year"
                              }
                            />
                          </SelectTrigger>

                          <SelectContent>
                            {financialYears.map((year) => (
                              <SelectItem key={year.id} value={year.id}>
                                {year.year_label}
                                {year.is_active ? " (Current)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Opening Balance */}
                      <div className="min-w-0 space-y-1.5">
                        <Label className="text-xs">Opening Balance (₹)</Label>

                        <Input
                          type="text"
                          inputMode="decimal"
                          className="w-full"
                          placeholder="0.00"
                          value={openingBalanceInput}
                          onChange={(e) => {
                            const value = e.target.value;

                            if (/^-?\d*\.?\d{0,2}$/.test(value)) {
                              setOpeningBalanceInput(value);
                            }
                          }}
                          disabled={
                            openingBalanceLoading || !selectedOpeningBalanceYear
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Maximum 12 digits before the decimal and 2 after it.
                      </p>

                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => saveOpeningBalance.mutate()}
                        disabled={
                          saveOpeningBalance.isPending ||
                          openingBalanceLoading ||
                          !selectedOpeningBalanceYear ||
                          !/^-?\d{1,12}(\.\d{1,2})?$/.test(
                            openingBalanceInput.trim()
                          )
                        }
                      >
                        {saveOpeningBalance.isPending
                          ? "Saving..."
                          : "Save Opening Balance"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed footer, outside the scrollable area */}
              <DialogFooter className="shrink-0 border-t px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={() => save.mutate()}
                  disabled={!form.customer_name.trim() || save.isPending}
                >
                  {save.isPending ? "Saving..." : "Save Customer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, GST, mobile…"
                className="h-9 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <CustomerTableRow key={r.id} row={r} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}