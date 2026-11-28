import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { extractInvoicePdfBulk } from "@/lib/invoice-pdf.functions";
import { saveBulkImportedInvoice } from "@/lib/bulk-invoice-import";
import { resolveCustomer, resolveProducts } from "@/components/forms/shared/resolve-document-data";
import { emptyItem, computeItem, type LineItem } from "@/components/forms/shared/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { amountInWords } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, FileText, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/invoices/bulk-import")({
  head: () => ({
    meta: [{ title: "Bulk Import Invoices — ABJAD ERP" }],
  }),
  component: BulkInvoiceImportPage,
});

type ExtractedInvoice = {
  customer_name?: string;
  company_name?: string;
  customer_address?: string;
  gst_number?: string;
  invoice_number?: string;
  invoice_date?: string;
  po_number?: string;
  po_date?: string;
  reference_challan_number?: string;
  reference_challan_dates?: string[];
  work_order_number?: string;
  freight?: number;
  packing_charges?: number;
  other_charges?: number;
  transportation_charges?: number;
  delivery_charges?: number;
  delivery_mode?: string;
  payment_terms?: string;
  notes?: string;
  items?: Array<{
    description?: string;
    quantity?: number;
    uom?: string;
    unit_rate?: number;
    discount_pct?: number;
    tax_pct?: number;
    hsn_code?: string;
  }>;
  [key: string]: unknown;
};

type ImportFile = {
  id: string;
  file: File;
  status: "pending" | "processing" | "success" | "error" | "saved";
  data?: ExtractedInvoice;
  items: LineItem[];
  customerId: string;
  customerName: string;
  customerCompany: string;
  customerAddress: string;
  customerGst: string;
  error?: string;
  duplicate?: boolean;
  saving?: boolean;
};

const CUSTOMER_COLUMNS =
  "id, customer_name, company_name, gst_number, billing_address, state, state_code, contact_person, mobile, email";
const PRODUCT_COLUMNS = "id, product_name, product_code, hsn_code, unit, gst_percentage, selling_price";

const MAX_FILES = 200;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const CONCURRENCY = 3;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const REFERENCE_STALE_MS = 5 * 60 * 1000;
const WHITESPACE = /\s+/g;

const CHARGE_FIELDS = [
  ["freight", "Freight"],
  ["packing_charges", "Packing Charges"],
  ["other_charges", "Other Charges"],
  ["transportation_charges", "Transportation Charges"],
  ["delivery_charges", "Delivery Charges"],
] as const;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read document."));
    reader.onerror = () => reject(new Error("Failed to read document."));
    reader.readAsDataURL(file);
  });
}

function toNumber(value: unknown, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function normalized(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(WHITESPACE, " ");
}

function getFinancialYear(date?: string | null) {
  if (!date) return "";

  const [yearPart, monthPart] = date.slice(0, 10).split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return "";
  }

  const startYear = month < 4 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
}

function invoiceDuplicateKey(invoiceNumber?: string | null, invoiceDate?: string | null) {
  const normalizedNumber = normalized(invoiceNumber);
  const financialYear = getFinancialYear(invoiceDate);
  if (!normalizedNumber || !financialYear) return "";
  return `${normalizedNumber}|${financialYear}`;
}

async function runPool<T>(queue: T[], worker: (entry: T) => Promise<void>, concurrency = CONCURRENCY) {
  let cursor = 0;
  const run = async () => {
    while (cursor < queue.length) {
      const entry = queue[cursor++];
      if (entry) await worker(entry);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, run));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const Stat = memo(function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
});

interface ImportFileCardProps {
  file: ImportFile;
  customerOptions: ReactNode;
  processing: boolean;
  bulkSaving: boolean;
  onUpdate: (id: string, patch: Partial<ImportFile>) => void;
  onExtractedField: (id: string, field: keyof ExtractedInvoice, value: unknown) => void;
  onItemField: (fileId: string, itemIndex: number, field: keyof LineItem, value: string | number) => void;
  onAddItem: (fileId: string) => void;
  onRemoveItem: (fileId: string, itemIndex: number) => void;
  onRemoveFile: (id: string) => void;
  onExtract: (file: ImportFile) => void;
  onApprove: (file: ImportFile) => void;
}

const ImportFileCard = memo(function ImportFileCard({
  file,
  customerOptions,
  processing,
  bulkSaving,
  onUpdate,
  onExtractedField,
  onItemField,
  onAddItem,
  onRemoveItem,
  onRemoveFile,
  onExtract,
  onApprove,
}: ImportFileCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="min-w-0">
          <CardTitle className="break-all text-base">{file.file.name}</CardTitle>
          <p className="text-xs text-muted-foreground">{(file.file.size / 1024).toFixed(0)} KB</p>
        </div>

        <div className="flex items-center gap-2">
          {file.status === "saved" && (
            <span className="text-sm text-green-600">
              <CheckCircle2 className="inline h-4 w-4" /> Imported
            </span>
          )}
          {file.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
          {file.status === "error" && (
            <Button size="icon" variant="ghost" onClick={() => onExtract(file)} disabled={processing}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onRemoveFile(file.id)}
            disabled={file.saving || bulkSaving}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {file.error && <p className="text-sm text-destructive">{file.error}</p>}

        {file.duplicate && file.status !== "saved" && (
          <p className="rounded-md border border-destructive p-3 text-sm text-destructive">
            This invoice number already exists in the same financial year.
          </p>
        )}

        {file.data && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Invoice Number">
                <Input
                  value={file.data.invoice_number ?? ""}
                  onChange={(e) => onExtractedField(file.id, "invoice_number", e.target.value)}
                />
              </Field>

              <Field label="Invoice Date">
                <Input
                  type="date"
                  value={file.data.invoice_date ?? ""}
                  onChange={(e) => onExtractedField(file.id, "invoice_date", e.target.value)}
                />
              </Field>

              <Field label="GST Number">
                <Input
                  value={file.customerGst}
                  onChange={(e) => onUpdate(file.id, { customerGst: e.target.value })}
                />
              </Field>

              <Field label="Customer / Contact Name">
                <Input
                  value={file.customerName}
                  onChange={(e) => onUpdate(file.id, { customerName: e.target.value })}
                />
              </Field>

              <Field label="Company Name">
                <Input
                  value={file.customerCompany}
                  onChange={(e) => onUpdate(file.id, { customerCompany: e.target.value })}
                />
              </Field>

              <Field label="Customer Address">
                <Input
                  value={file.customerAddress}
                  onChange={(e) => onUpdate(file.id, { customerAddress: e.target.value })}
                />
              </Field>

              <Field label="PO Number">
                <Input
                  value={file.data.po_number ?? ""}
                  onChange={(e) => onExtractedField(file.id, "po_number", e.target.value)}
                />
              </Field>

              <Field label="PO Date">
                <Input
                  type="date"
                  value={file.data.po_date ?? ""}
                  onChange={(e) => onExtractedField(file.id, "po_date", e.target.value)}
                />
              </Field>

              <Field label="Challan Number(s)">
                <Input
                  value={file.data.reference_challan_number ?? ""}
                  onChange={(e) => onExtractedField(file.id, "reference_challan_number", e.target.value)}
                />
              </Field>

              <Field label="Challan Date(s) — one per line">
                <Textarea
                  rows={3}
                  value={(file.data.reference_challan_dates ?? []).join("\n")}
                  onChange={(e) =>
                    onExtractedField(
                      file.id,
                      "reference_challan_dates",
                      e.target.value
                        .split(/\r?\n/)
                        .map((value) => value.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </Field>

              <Field label="Work Order">
                <Input
                  value={file.data.work_order_number ?? ""}
                  onChange={(e) => onExtractedField(file.id, "work_order_number", e.target.value)}
                />
              </Field>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Customer Match</p>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={file.customerId}
                onChange={(e) => onUpdate(file.id, { customerId: e.target.value })}
              >
                <option value="">Auto-match by GST / name or create new</option>
                {/* Built once per customers change and shared by every card. */}
                {customerOptions}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                If no customer is selected, the importer matches by GST/name and creates one if no match is
                found.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {CHARGE_FIELDS.map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    value={toNumber(file.data?.[key])}
                    onChange={(e) => onExtractedField(file.id, key, toNumber(e.target.value))}
                  />
                </Field>
              ))}
            </div>

            <Field label="Notes">
              <Textarea
                value={file.data.notes ?? ""}
                onChange={(e) => onExtractedField(file.id, "notes", e.target.value)}
              />
            </Field>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Invoice Items</h3>
                <Button size="sm" variant="outline" onClick={() => onAddItem(file.id)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {file.items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-lg border p-3 md:grid-cols-7">
                  <div className="md:col-span-2">
                    <Field label="Description">
                      <Input
                        value={item.description}
                        onChange={(e) => onItemField(file.id, index, "description", e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="HSN">
                    <Input
                      value={item.hsn_code}
                      onChange={(e) => onItemField(file.id, index, "hsn_code", e.target.value)}
                    />
                  </Field>

                  <Field label="Quantity">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => onItemField(file.id, index, "quantity", toNumber(e.target.value))}
                    />
                  </Field>

                  <Field label="Unit">
                    <Input value={item.uom} onChange={(e) => onItemField(file.id, index, "uom", e.target.value)} />
                  </Field>

                  <Field label="Rate">
                    <Input
                      type="number"
                      value={item.unit_rate}
                      onChange={(e) => onItemField(file.id, index, "unit_rate", toNumber(e.target.value))}
                    />
                  </Field>

                  <Field label="GST %">
                    <Input
                      type="number"
                      value={item.tax_pct}
                      onChange={(e) => onItemField(file.id, index, "tax_pct", toNumber(e.target.value))}
                    />
                  </Field>

                  <div className="flex items-end justify-between md:col-span-7">
                    <span className="text-xs text-muted-foreground">
                      Line total: {computeItem(item).total_amount.toFixed(2)}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => onRemoveItem(file.id, index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => onApprove(file)}
                disabled={file.status !== "success" || file.duplicate || file.saving || bulkSaving}
              >
                {file.saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve & Import Invoice
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
});

function BulkInvoiceImportPage() {
  const runExtract = useServerFn(extractInvoicePdfBulk);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [files, setFiles] = useState<ImportFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const customerResolutionCacheRef = useRef(new Map<string, Promise<any>>());

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    staleTime: REFERENCE_STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select(CUSTOMER_COLUMNS);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    staleTime: REFERENCE_STALE_MS,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select(PRODUCT_COLUMNS);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: existingInvoices = [] } = useQuery({
    queryKey: ["bulk-import-existing-invoice-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_number, invoice_date")
        .not("invoice_number", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const invoice of existingInvoices) {
      const key = invoiceDuplicateKey(invoice.invoice_number, invoice.invoice_date);
      if (key) keys.add(key);
    }
    return keys;
  }, [existingInvoices]);

  const latest = useRef({ customers, products, userId: user?.id, existingKeys, runExtract });
  latest.current = { customers, products, userId: user?.id, existingKeys, runExtract };

  const filesRef = useRef(files);
  filesRef.current = files;

  const customerOptions = useMemo(
    () =>
      customers.map((customer: any) => (
        <option key={customer.id} value={customer.id}>
          {customer.company_name || customer.customer_name}
          {customer.gst_number ? ` — ${customer.gst_number}` : ""}
        </option>
      )),
    [customers],
  );

  const updateFile = useCallback((id: string, patch: Partial<ImportFile>) => {
    setFiles((current) => current.map((file) => (file.id === id ? { ...file, ...patch } : file)));
  }, []);

  const checkDuplicates = useCallback((list: ImportFile[]) => {
    const existing = latest.current.existingKeys;
    const seen = new Set<string>();

    return list.map((file) => {
      const key = invoiceDuplicateKey(file.data?.invoice_number, file.data?.invoice_date);
      const duplicate = !!key && (existing.has(key) || seen.has(key));
      if (key) seen.add(key);
      return { ...file, duplicate };
    });
  }, []);

  const updateExtractedField = useCallback(
    (id: string, field: keyof ExtractedInvoice, value: unknown) => {
      const affectsDuplicates = field === "invoice_number" || field === "invoice_date";

      setFiles((current) => {
        const next = current.map((file) =>
          file.id === id ? { ...file, data: { ...file.data, [field]: value } } : file,
        );
        return affectsDuplicates ? checkDuplicates(next) : next;
      });
    },
    [checkDuplicates],
  );

  const updateItem = useCallback(
    (fileId: string, itemIndex: number, field: keyof LineItem, value: string | number) => {
      setFiles((current) =>
        current.map((file) =>
          file.id === fileId
            ? {
              ...file,
              items: file.items.map((item, index) => (index === itemIndex ? { ...item, [field]: value } : item)),
            }
            : file,
        ),
      );
    },
    [],
  );

  const addItem = useCallback((fileId: string) => {
    setFiles((current) =>
      current.map((file) =>
        file.id === fileId ? { ...file, items: [...file.items, emptyItem(file.items.length + 1)] } : file,
      ),
    );
  }, []);

  const removeItem = useCallback((fileId: string, itemIndex: number) => {
    setFiles((current) =>
      current.map((file) =>
        file.id === fileId ? { ...file, items: file.items.filter((_, i) => i !== itemIndex) } : file,
      ),
    );
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const extractFile = useCallback(
    async (entry: ImportFile) => {
      updateFile(entry.id, { status: "processing", error: undefined });

      try {
        const fileData = await readFileAsDataUrl(entry.file);

        const result = (await latest.current.runExtract({
          data: { fileData, fileName: entry.file.name },
        })) as ExtractedInvoice;

        const items = (result.items ?? []).map((item, index) => ({
          ...emptyItem(index + 1),
          description: item.description ?? "",
          quantity: toNumber(item.quantity, 1),
          uom: item.uom ?? "PCS",
          unit_rate: toNumber(item.unit_rate),
          tax_pct: toNumber(item.tax_pct, 18),
          discount_mode: "pct" as const,
          discount_value: toNumber(item.discount_pct),
          hsn_code: item.hsn_code ?? "",
        }));

        setFiles((current) =>
          checkDuplicates(
            current.map((file) =>
              file.id === entry.id
                ? {
                  ...file,
                  status: "success" as const,
                  data: result,
                  items,
                  customerName: result.customer_name ?? "",
                  customerCompany: result.company_name ?? "",
                  customerAddress: result.customer_address ?? "",
                  customerGst: result.gst_number ?? "",
                }
                : file,
            ),
          ),
        );
      } catch (error) {
        updateFile(entry.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Extraction failed.",
        });
      }
    },
    [updateFile, checkDuplicates],
  );

  const handleFilesSelected = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const remaining = MAX_FILES - filesRef.current.length;

    const additions: ImportFile[] = selected
      .slice(0, remaining)
      .filter((file) => {
        const extension = file.name.split(".").pop()?.toLowerCase();
        return ALLOWED_EXTENSIONS.has(extension ?? "") && file.size <= MAX_FILE_SIZE;
      })
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "pending" as const,
        items: [],
        customerId: "",
        customerName: "",
        customerCompany: "",
        customerAddress: "",
        customerGst: "",
      }));

    if (additions.length !== selected.length) {
      toast.warning("Some files were skipped. Check the supported formats and 15 MB limit.");
    }

    setFiles((current) => [...current, ...additions]);
    event.target.value = "";
  }, []);

  const startExtraction = useCallback(async () => {
    const queue = files.filter((file) => file.status === "pending");
    if (!queue.length || processing) return;

    setProcessing(true);
    try {
      await runPool(queue, extractFile);
    } finally {
      setProcessing(false);
    }
  }, [files, processing, extractFile]);

  const refreshAll = useCallback(async () => {
    const queue = files.filter((file) => file.status === "error" && !file.saving);

    if (!queue.length || processing || bulkSaving) {
      if (!queue.length && files.length > 0) {
        toast.info("There are no extraction failures to retry.");
      }
      return;
    }

    if (
      !window.confirm(
        `Retry Gemini extraction for ${queue.length} failed document(s)? Successfully extracted invoices and imported invoices will not be changed.`,
      )
    ) {
      return;
    }

    setProcessing(true);
    try {
      await runPool(queue, extractFile);
      toast.success(`Retried extraction for ${queue.length} failed document(s).`);
    } finally {
      setProcessing(false);
    }
  }, [files, processing, bulkSaving, extractFile]);

  const discardAll = useCallback(() => {
    if (!files.length || processing || bulkSaving) return;

    const importedCount = files.filter((file) => file.status === "saved").length;
    const message =
      importedCount > 0
        ? `Discard all ${files.length} document(s) from this page? The ${importedCount} already imported invoice(s) will remain saved in the ERP.`
        : `Discard all ${files.length} document(s) from this import queue?`;

    if (!window.confirm(message)) return;

    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    toast.success("All documents were removed from the import queue.");
  }, [files, processing, bulkSaving]);

  const approveInvoice = useCallback(
    async (file: ImportFile) => {
      if (!file.data) throw new Error("Invoice extraction is missing.");
      if (!file.data.invoice_number?.trim()) throw new Error("Invoice number is required.");
      if (!file.data.invoice_date) throw new Error("Invoice date is required.");
      if (!getFinancialYear(file.data.invoice_date)) {
        throw new Error("Enter a valid invoice date to determine its financial year.");
      }
      if (!file.customerCompany.trim()) throw new Error("Customer company name is required.");
      if (!file.items.length) throw new Error("Add at least one invoice item.");

      const { customers, products, userId } = latest.current;

      const fileGst = normalized(file.customerGst);
      const fileCompany = normalized(file.customerCompany);
      const fileName = normalized(file.customerCompany || file.customerName);

      const findCustomer = () =>
        customers.find((customer: any) => {
          if (fileGst && normalized(customer.gst_number) === fileGst) return true;
          return (
            !!fileName &&
            (normalized(customer.company_name) === fileName || normalized(customer.customer_name) === fileName)
          );
        });

      const matchedCustomer = customers.find((customer: any) => customer.id === file.customerId) ?? findCustomer();
      const cache = customerResolutionCacheRef.current;
      const customerKey = file.customerGst
        ? `gst:${fileGst}`
        : file.customerCompany
          ? `company:${fileCompany}`
          : "";
      let customerPromise = customerKey ? cache.get(customerKey) : undefined;

      if (!customerPromise) {
        customerPromise = resolveCustomer({
          supabase,
          customer: matchedCustomer,
          customers,
          customerText: file.customerName || file.customerCompany,
          custCompany: file.customerCompany,
          custAddress: file.customerAddress,
          custMobile: "",
          custEmail: "",
          custGst: file.customerGst,
          createdBy: userId,
        });
        if (customerKey) cache.set(customerKey, customerPromise);
      }

      let customer: any;
      try {
        customer = await customerPromise;
      } catch (error) {
        if (customerKey && cache.get(customerKey) === customerPromise) cache.delete(customerKey);
        throw error;
      }
      if (customerKey) cache.set(customerKey, Promise.resolve(customer));

      queryClient.setQueryData<any[]>(["customers-list"], (current = []) => {
        const existing = current.find((entry) => entry.id === customer.id);
        if (!existing) return [...current, customer];
        const unchanged = Object.keys(customer).every((k) => existing[k] === customer[k]);
        return unchanged
          ? current
          : current.map((entry) => (entry.id === customer.id ? { ...entry, ...customer } : entry));
      });

      setFiles((current) =>
        current.map((entry) => {
          const entryGst = normalized(entry.customerGst);
          const sameCustomer =
            fileGst && entryGst
              ? fileGst === entryGst
              : !!fileCompany && normalized(entry.customerCompany) === fileCompany;

          return sameCustomer && entry.customerId !== customer.id ? { ...entry, customerId: customer.id } : entry;
        }),
      );

      const resolvedItems = await resolveProducts({
        supabase,
        items: file.items,
        productTexts: file.items.map((item) => item.description),
        products,
      });

      let net = 0;
      let discount = 0;
      let tax = 0;
      for (const item of resolvedItems) {
        const c = computeItem(item);
        net += c.net;
        discount += c.discount_amount;
        tax += c.tax_amount;
      }

      const freight = toNumber(file.data.freight);
      const packing = toNumber(file.data.packing_charges);
      const other = toNumber(file.data.other_charges);
      const transport = toNumber(file.data.transportation_charges);
      const delivery = toNumber(file.data.delivery_charges);

      const subtotal = net + freight + packing + other + transport + delivery;
      const preRound = subtotal + tax;
      const grand = Math.round(preRound);
      const roundOff = grand - preRound;

      const companyState = await queryClient.fetchQuery({
        queryKey: ["company-state-code"],
        staleTime: REFERENCE_STALE_MS,
        queryFn: async () => {
          const result = await supabase.from("company_profile").select("state_code").limit(1).maybeSingle();
          if (result.error) throw result.error;
          return result.data?.state_code ?? null;
        },
      });

      const customerState = customer.state_code;
      const isIGST = !!(customerState && companyState && customerState !== companyState);

      const invoice = {
        invoice_number: file.data.invoice_number.trim(),
        invoice_date: file.data.invoice_date,
        customer_id: customer.id,
        customer_name_snapshot: customer.company_name || customer.customer_name,
        customer_gst_snapshot: customer.gst_number || null,
        customer_address_snapshot: file.customerAddress || customer.billing_address || null,
        po_number: file.data.po_number || null,
        po_date: file.data.po_date || null,
        work_order_number: file.data.work_order_number || null,
        is_igst: isIGST,
        net_value: net,
        discount_amount: discount,
        freight,
        packing_charges: packing,
        other_charges: other,
        subtotal,
        sgst_amount: isIGST ? 0 : tax / 2,
        cgst_amount: isIGST ? 0 : tax / 2,
        igst_amount: isIGST ? tax : 0,
        round_off: roundOff,
        grand_total: grand,
        amount_in_words: amountInWords(grand),
        delivery_mode: file.data.delivery_mode || null,
        payment_terms: file.data.payment_terms || null,
        contact_person: file.customerName || null,
        contact_mobile: null,
        notes: file.data.notes || null,
        transportation_charges: transport,
        delivery_charges: delivery,
        reference_challan_number: file.data.reference_challan_number?.trim() || null,
        reference_challan_date: file.data.reference_challan_dates?.[0] || null,
        reference_challan_dates: file.data.reference_challan_dates ?? [],
      };

      return saveBulkImportedInvoice(invoice, resolvedItems);
    },
    [queryClient],
  );

  const refreshInvoiceQueries = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bulk-import-existing-invoice-numbers"] }),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      ]),
    [queryClient],
  );

  const importOne = useCallback(
    async (file: ImportFile): Promise<boolean> => {
      if (file.status !== "success" || file.duplicate || file.saving) return false;

      updateFile(file.id, { saving: true, error: undefined });

      try {
        await approveInvoice(file);
        updateFile(file.id, { status: "saved", saving: false });
        toast.success(`Invoice ${file.data?.invoice_number} imported.`);
        return true;
      } catch (error) {
        updateFile(file.id, {
          saving: false,
          error: error instanceof Error ? error.message : "Import failed.",
        });
        return false;
      }
    },
    [updateFile, approveInvoice],
  );

  const approveOne = useCallback(
    async (file: ImportFile) => {
      if (await importOne(file)) await refreshInvoiceQueries();
    },
    [importOne, refreshInvoiceQueries],
  );

  const approveAll = async () => {
    const eligible = files.filter((file) => file.status === "success" && !file.duplicate && !file.saving);

    if (!eligible.length || bulkSaving) return;

    setBulkSaving(true);

    try {
      let importedAny = false;
      for (const file of eligible) {
        if (await importOne(file)) importedAny = true;
      }
      if (importedAny) await refreshInvoiceQueries();
    } finally {
      setBulkSaving(false);
    }
  };

  const stats = useMemo(() => {
    const s = { total: files.length, extracted: 0, failed: 0, saved: 0, duplicates: 0, pending: 0, retryable: 0 };
    for (const file of files) {
      if (file.status === "success") s.extracted++;
      else if (file.status === "error") {
        s.failed++;
        if (!file.saving) s.retryable++;
      } else if (file.status === "saved") s.saved++;
      else if (file.status === "pending") s.pending++;
      if (file.duplicate) s.duplicates++;
    }
    return s;
  }, [files]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bulk Invoice Import</h1>
          <p className="text-sm text-muted-foreground">
            Review extracted invoices, correct fields, match records and import approved invoices.
          </p>
        </div>

        <Button onClick={approveAll} disabled={bulkSaving || stats.extracted === 0}>
          {bulkSaving ? "Importing..." : `Approve & Import All (${stats.extracted - stats.duplicates})`}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Invoice Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleFilesSelected}
          />

          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={processing || files.length >= MAX_FILES}
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose Documents
          </Button>

          <Button onClick={startExtraction} disabled={processing || stats.pending === 0}>
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Extract Pending Documents
          </Button>

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={refreshAll}
              disabled={processing || bulkSaving || stats.retryable === 0}
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh All
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={discardAll}
              disabled={processing || bulkSaving || files.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Discard All
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Total" value={stats.total} />
            <Stat label="Extracted" value={stats.extracted} />
            <Stat label="Failed" value={stats.failed} />
            <Stat label="Duplicates" value={stats.duplicates} />
            <Stat label="Imported" value={stats.saved} />
          </div>
        </CardContent>
      </Card>

      {files.map((file) => (
        <ImportFileCard
          key={file.id}
          file={file}
          customerOptions={customerOptions}
          processing={processing}
          bulkSaving={bulkSaving}
          onUpdate={updateFile}
          onExtractedField={updateExtractedField}
          onItemField={updateItem}
          onAddItem={addItem}
          onRemoveItem={removeItem}
          onRemoveFile={removeFile}
          onExtract={extractFile}
          onApprove={approveOne}
        />
      ))}
    </div>
  );
}