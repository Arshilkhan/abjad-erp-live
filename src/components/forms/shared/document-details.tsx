import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TypeaheadInput } from "@/components/typeahead-input";
import { Upload, Loader2, X } from "lucide-react";
import { MOVEMENT_REASONS } from "./types";

interface Customer {
  id: string;
  customer_name?: string | null;
  company_name?: string | null;
  gst_number?: string | null;
  billing_address?: string | null;
  mobile?: string | null;
  email?: string | null;
  state?: string | null;
  state_code?: string | null;
  bank_account_id?: string | null;
}

interface InvoiceSettings {
  mandatory_gst_number?: boolean | null;
  mandatory_challan_number?: boolean | null;
  show_work_order?: boolean | null;
}

interface DocumentDetailsProps {
  isNote: boolean
  referenceChallanNumber: string;
  referenceChallanDates: string[];
  referenceChallanDateInput: string;
  setReferenceChallanDateInput: (value: string) => void;
  setReferenceChallanDates: React.Dispatch<React.SetStateAction<string[]>>;
  addReferenceChallanDate: () => void;
  setReferenceChallanNumber: (value: string) => void;
  isChallan: boolean;
  isEdit: boolean;
  isTaxInvoice: boolean;
  isIGST: boolean;
  docLabel: string;
  documentNumber: string;
  setDocumentNumber: (value: string) => void;
  documentNumberLabel: string;
  poNumber: string;
  setPoNumber: (value: string) => void;
  poDate: string;
  setPoDate: (value: string) => void;
  customers: Customer[];
  settings?: InvoiceSettings | null;
  customerId: string;
  customerText: string;
  custCompany: string;
  custAddress: string;
  custMobile: string;
  custEmail: string;
  custGst: string;

  invoiceDate: string;
  movementReason: string;
  challanNumber: string;
  challanDates: string[];
  challanDateInput: string;
  workOrder: string;

  extracting: boolean;
  pdfName: string;
  pdfImported: boolean;

  setCustomerId: (value: string) => void;
  setCustomerText: (value: string) => void;
  setCustCompany: (value: string) => void;
  setCustAddress: (value: string) => void;
  setCustMobile: (value: string) => void;
  setCustEmail: (value: string) => void;
  setCustGst: (value: string) => void;
  setInvoiceDate: (value: string) => void;
  setMovementReason: (value: string) => void;
  setChallanNumber: (value: string) => void;
  setChallanDateInput: (value: string) => void;
  setWorkOrder: (value: string) => void;
  setChallanDates: React.Dispatch<React.SetStateAction<string[]>>;

  addChallanDate: () => void;
  handlePdf: (file: File) => void | Promise<unknown>;
}

function formatDateDisplay(value: string): string {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}-${month}-${year}`;
}

export function DocumentDetails({
  referenceChallanNumber,
  referenceChallanDates,
  referenceChallanDateInput,
  setReferenceChallanDateInput,
  setReferenceChallanDates,
  addReferenceChallanDate,
  setReferenceChallanNumber,
  isChallan,
  isNote,
  isEdit,
  isTaxInvoice,
  isIGST,
  docLabel,
  documentNumber,
  setDocumentNumber,
  documentNumberLabel,
  poNumber,
  setPoNumber,
  poDate,
  setPoDate,
  customers,
  settings,

  customerId,
  customerText,
  custCompany,
  custAddress,
  custMobile,
  custEmail,
  custGst,

  invoiceDate,
  movementReason,
  challanNumber,
  challanDates,
  challanDateInput,
  workOrder,

  extracting,
  pdfName,
  pdfImported,

  setCustomerId,
  setCustomerText,
  setCustCompany,
  setCustAddress,
  setCustMobile,
  setCustEmail,
  setCustGst,
  setInvoiceDate,
  setMovementReason,
  setChallanNumber,
  setChallanDateInput,
  setWorkOrder,
  setChallanDates,

  addChallanDate,
  handlePdf,
}: DocumentDetailsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            {isChallan ? "Delivery Challan Details" : isNote ? `${docLabel} Details` : "Invoice Details"}
          </CardTitle>

          {!isEdit && isTaxInvoice && (
            <>
              <input
                id="invoice-pdf"
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                disabled={extracting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void handlePdf(f);
                }}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={extracting}
                asChild={!extracting}
              >
                {extracting ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Importing…
                  </span>
                ) : (
                  <label htmlFor="invoice-pdf" className="cursor-pointer">
                    <Upload className="mr-1 h-4 w-4" />
                    Import Invoice
                  </label>
                )}
              </Button>
            </>
          )}
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {!isEdit && pdfName && (
            <div className="col-span-2 space-y-1.5 md:col-span-4">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
                <span className="text-xs text-muted-foreground">
                  {extracting
                    ? `Reading ${pdfName}…`
                    : pdfImported
                      ? `${pdfName} imported. Review the details below before saving.`
                      : `Could not import ${pdfName}. Choose another document to try again.`}
                </span>
              </div>
            </div>
          )}

          {!isChallan && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm font-semibold">
                {documentNumberLabel} *
              </Label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="e.g. AEW/INV/2026-27/001"
                className="font-mono"
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter the official document number. It must be unique within this document type.
              </p>
            </div>
          )}

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Customer Name</Label>

            <TypeaheadInput
              value={customerText}
              onChange={(v) => {
                setCustomerText(v);
                if (customerId) setCustomerId("");
              }}
              options={customers.map((c) => ({
                id: c.id,
                label: c.customer_name || c.company_name || "",
                sublabel: [c.company_name, c.gst_number]
                  .filter(Boolean)
                  .join(" • "),
              }))}
              onSelect={(opt) => {
                setCustomerId(opt.id);
                setCustomerText(opt.label);
              }}
              placeholder="Type a customer name — new names are saved automatically"
            />

            {!customerId && customerText.trim() && (
              <p className="text-xs text-muted-foreground">
                New customer — will be added to your directory on save.
              </p>
            )}
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Company Name *</Label>
            <Input
              value={custCompany}
              onChange={(e) => setCustCompany(e.target.value)}
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Address</Label>
            <Textarea
              rows={2}
              value={custAddress}
              onChange={(e) => setCustAddress(e.target.value)}
              placeholder="Customer billing address"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mobile</Label>
            <Input
              value={custMobile}
              onChange={(e) => setCustMobile(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={custEmail}
              onChange={(e) => setCustEmail(e.target.value)}
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">
              GST Number{settings?.mandatory_gst_number && " *"}
            </Label>
            <Input
              className="font-mono"
              value={custGst}
              onChange={(e) => setCustGst(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Input value={docLabel} readOnly disabled />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {isChallan ? "Delivery Challan Date" : isNote ? `${docLabel} Date` : "Date"}
            </Label>
            <Input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          {(isTaxInvoice || isNote) && !isChallan && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">PO No.</Label>
                <Input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="Enter purchase order number"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO DATE</Label>
                <Input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Challan No.</Label>
                <Input
                  value={referenceChallanNumber}
                  onChange={(e) => setReferenceChallanNumber(e.target.value)}
                  placeholder="Enter reference challan number"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Challan Dates</Label>

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={referenceChallanDateInput}
                    onChange={(e) => setReferenceChallanDateInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addReferenceChallanDate();
                      }
                    }}
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addReferenceChallanDate}
                  >
                    Add
                  </Button>
                </div>

                {referenceChallanDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {referenceChallanDates.map((d) => (
                      <span
                        key={d}
                        className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
                      >
                        {formatDateDisplay(d)}

                        <button
                          type="button"
                          aria-label={`Remove ${d}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setReferenceChallanDates((prev) =>
                              prev.filter((x) => x !== d)
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {isChallan && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Reason for Movement</Label>

              <Select
                value={movementReason}
                onValueChange={setMovementReason}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {MOVEMENT_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isChallan && (
            <>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">
                  Challan Numbers (comma separated)
                  {settings?.mandatory_challan_number && " *"}
                </Label>

                <Input
                  value={challanNumber}
                  placeholder="DC-001, DC-002, DC-003"
                  onChange={(e) => setChallanNumber(e.target.value)}
                />

                {challanNumber.trim() && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {challanNumber
                      .split(",")
                      .map((n) => n.trim())
                      .filter(Boolean)
                      .map((n, i) => (
                        <span
                          key={`${n}-${i}`}
                          className="rounded-md bg-muted px-2 py-0.5 text-xs"
                        >
                          {n}
                        </span>
                      ))}
                  </div>
                )}
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Challan Dates</Label>

                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={challanDateInput}
                    onChange={(e) => setChallanDateInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addChallanDate();
                      }
                    }}
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addChallanDate}
                  >
                    Add
                  </Button>
                </div>

                {challanDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {challanDates.map((d) => (
                      <span
                        key={d}
                        className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
                      >
                        {formatDateDisplay(d)}

                        <button
                          type="button"
                          aria-label={`Remove ${d}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setChallanDates((prev) =>
                              prev.filter((x) => x !== d),
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {(settings?.show_work_order || isEdit) && (
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Work Order Number</Label>
              <Input
                value={workOrder}
                onChange={(e) => setWorkOrder(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Info</CardTitle>
        </CardHeader>

        <CardContent className="space-y-1 text-sm">
          {(() => {
            const customer = customers.find((c) => c.id === customerId);

            return customer ? (
              <>
                <div className="font-medium">
                  {customer.company_name || customer.customer_name}
                </div>

                <div className="text-xs text-muted-foreground whitespace-pre-line">
                  {customer.billing_address}
                </div>

                <div className="pt-2 text-xs">
                  <span className="text-muted-foreground">GST:</span>{" "}
                  <span className="font-mono">
                    {customer.gst_number ?? "—"}
                  </span>
                </div>

                <div className="text-xs">
                  <span className="text-muted-foreground">State:</span>{" "}
                  {customer.state} ({customer.state_code})
                </div>

                <div className="mt-2 rounded bg-secondary px-2 py-1 text-xs font-medium">
                  {isIGST
                    ? "Inter-state → IGST"
                    : "Intra-state → SGST + CGST"}
                </div>
              </>
            ) : customerText.trim() ? (
              <>
                <div className="font-medium">
                  {custCompany || customerText}
                </div>

                <div className="text-xs text-muted-foreground">
                  New customer — saved when you save this invoice.
                </div>

                <div className="pt-2 text-xs">
                  <span className="text-muted-foreground">GST:</span>{" "}
                  <span className="font-mono">
                    {custGst || "—"}
                  </span>
                </div>

                <div className="text-xs">
                  <span className="text-muted-foreground">Mobile:</span>{" "}
                  {custMobile || "—"}
                </div>

                <div className="text-xs">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {custEmail || "—"}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                Type a customer name to begin.
              </p>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}