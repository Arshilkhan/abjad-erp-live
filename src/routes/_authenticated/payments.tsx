
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TypeaheadInput } from "@/components/typeahead-input";
import { formatINR, formatDate, billNo } from "@/lib/format";
import { Plus, RotateCcw, Ban, Wallet } from "lucide-react";
import { toast } from "sonner";
import { logInvoiceEvent } from "@/lib/invoice-history";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — ABJAD ERP" }] }),
  component: PaymentsPage,
});

type Customer = {
  id: string;
  customer_name: string;
  company_name: string | null;
  mobile: string | null;
  gst_number: string | null;
};

type Invoice = {
  id: string;
  customer_id: string | null;
  invoice_number: string;
  customer_name_snapshot: string | null;
  invoice_date: string;
  grand_total: number | null;
  amount_paid: number | null;
  status: string;
};

type Payment = {
  id: string;
  customer_id: string;
  invoice_id: string | null;
  payment_date: string;
  amount: number;
  mode: string;
  reference: string | null;
  notes: string | null;
  status: string;
  cancellation_reason: string | null;
  customers: {
    customer_name: string;
    company_name: string | null;
  } | null;
};

type Allocation = {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  status: string;
  reversal_reason: string | null;
  reversed_at: string | null;
  invoices: {
    invoice_number: string;
  } | null;
};

function localDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCustomerName(customer: Customer | Payment["customers"] | null) {
  if (!customer) return "—";
  return customer.company_name?.trim() || customer.customer_name?.trim() || "—";
}

function getInvoiceDue(invoice: Invoice) {
  return Math.max(
    Number(invoice.grand_total ?? 0) - Number(invoice.amount_paid ?? 0),
    0,
  );
}

function getAllocatedAmount(payment: Payment, allocations: Allocation[]) {
  if (payment.status !== "received") return 0;

  return allocations
    .filter(
      (allocation) =>
        allocation.payment_id === payment.id &&
        allocation.status === "active",
    )
    .reduce(
      (total, allocation) => total + Number(allocation.allocated_amount),
      0,
    );
}

function getUnallocatedAmount(payment: Payment, allocations: Allocation[]) {
  if (payment.status !== "received") return 0;

  return Math.max(
    Number(payment.amount) - getAllocatedAmount(payment, allocations),
    0,
  );
}

function PaymentsPage() {
  const qc = useQueryClient();

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [allocationPayment, setAllocationPayment] = useState<Payment | null>(
    null,
  );
  const [reversalAllocation, setReversalAllocation] =
    useState<Allocation | null>(null);
  const [cancellationPayment, setCancellationPayment] =
    useState<Payment | null>(null);

  const customersQuery = useQuery({
    queryKey: ["payment-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, customer_name, company_name, mobile, gst_number")
        .order("customer_name");

      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ["outstanding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, customer_id, invoice_number, customer_name_snapshot, invoice_date, grand_total, amount_paid, status",
        )
        .eq("invoice_type", "tax_invoice")
        .in("status", ["sent", "partial"])
        .order("invoice_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["payment-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, customer_id, invoice_id, payment_date, amount, mode, reference, notes, status, cancellation_reason, customers(customer_name, company_name)",
        )
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });

  const allocationsQuery = useQuery({
    queryKey: ["payment-allocations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_allocations")
        .select(
          "id, payment_id, invoice_id, allocated_amount, status, reversal_reason, reversed_at, invoices(invoice_number)",
        );

      if (error) throw error;
      return (data ?? []) as unknown as Allocation[];
    },
  });

  const customers = customersQuery.data ?? [];
  const outstanding = invoicesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const allocations = allocationsQuery.data ?? [];

  const isLoading =
    customersQuery.isLoading ||
    invoicesQuery.isLoading ||
    paymentsQuery.isLoading ||
    allocationsQuery.isLoading;

  const refreshData = () => {
    void qc.invalidateQueries({ queryKey: ["outstanding"] });
    void qc.invalidateQueries({ queryKey: ["payment-history"] });
    void qc.invalidateQueries({ queryKey: ["payment-allocations"] });
    void qc.invalidateQueries({ queryKey: ["invoices"] });
    void qc.invalidateQueries({ queryKey: ["payment-customers"] });
  };

  const totalOutstanding = outstanding.reduce(
    (total, invoice) => total + getInvoiceDue(invoice),
    0,
  );

  const overdue = outstanding.filter(
    (invoice) => invoice.invoice_date < localDate() && getInvoiceDue(invoice) > 0,
  ).length;

  const receivedPayments = payments.filter(
    (payment) => payment.status === "received",
  );

  const unallocatedPayments = receivedPayments.filter(
    (payment) => getUnallocatedAmount(payment, allocations) > 0.009,
  );

  const totalUnallocated = unallocatedPayments.reduce(
    (total, payment) =>
      total + getUnallocatedAmount(payment, allocations),
    0,
  );

  const openReceipt = () => setReceiptOpen(true);

  return (
    <>
      <PageHeader
        title="Payments"
        description="Manage customer receipts, invoice allocations and outstanding receivables."
        actions={
          <Button onClick={openReceipt}>
            <Plus className="mr-1 h-4 w-4" />
            Record Receipt
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total Outstanding"
          value={formatINR(totalOutstanding)}
          accent="warning"
        />
        <Stat label="Open Invoices" value={String(outstanding.length)} />
        <Stat
          label="Unallocated Advances"
          value={formatINR(totalUnallocated)}
        />
        <Stat
          label="Overdue Invoices"
          value={String(overdue)}
          accent={overdue ? "warning" : undefined}
        />
      </div>

      <Tabs defaultValue="outstanding">
        <TabsList className="mb-3">
          <TabsTrigger value="outstanding">
            Outstanding ({outstanding.length})
          </TabsTrigger>
          <TabsTrigger value="unallocated">
            Unallocated ({unallocatedPayments.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Receipt History ({payments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outstanding">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Loading payment data…
                      </TableCell>
                    </TableRow>
                  )}

                  {!isLoading && outstanding.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No outstanding tax invoices.
                      </TableCell>
                    </TableRow>
                  )}

                  {outstanding.map((invoice) => {
                    const due = getInvoiceDue(invoice);

                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono">
                          {billNo(invoice.invoice_number)}
                        </TableCell>
                        <TableCell>
                          {invoice.customer_name_snapshot ?? "—"}
                        </TableCell>
                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(invoice.grand_total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(invoice.amount_paid)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatINR(due)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="uppercase text-[10px]"
                          >
                            {invoice.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unallocated">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {!isLoading && unallocatedPayments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No unallocated customer advances.
                      </TableCell>
                    </TableRow>
                  )}

                  {unallocatedPayments.map((payment) => {
                    const allocated = getAllocatedAmount(payment, allocations);
                    const available = getUnallocatedAmount(
                      payment,
                      allocations,
                    );

                    return (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>
                          {getCustomerName(payment.customers)}
                        </TableCell>
                        <TableCell className="text-xs uppercase">
                          {payment.mode}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {payment.reference ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(payment.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatINR(allocated)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatINR(available)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAllocationPayment(payment)}
                          >
                            Allocate
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Invoice Allocations</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {!isLoading && payments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No receipts recorded yet.
                      </TableCell>
                    </TableRow>
                  )}

                  {payments.map((payment) => {
                    const paymentAllocations = allocations.filter(
                      (allocation) => allocation.payment_id === payment.id,
                    );

                    return (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.payment_date)}</TableCell>
                        <TableCell>
                          {getCustomerName(payment.customers)}
                        </TableCell>
                        <TableCell className="text-xs uppercase">
                          {payment.mode}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {payment.reference ?? "—"}
                        </TableCell>
                        <TableCell>
                          {paymentAllocations.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Unallocated
                            </span>
                          ) : (
                            <div className="space-y-1">
                              {paymentAllocations.map((allocation) => (
                                <div
                                  key={allocation.id}
                                  className="flex flex-wrap items-center gap-1 text-xs"
                                >
                                  <span className="font-mono">
                                    {billNo(allocation.invoices?.invoice_number)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatINR(allocation.allocated_amount)}
                                  </span>

                                  {allocation.status === "reversed" ? (
                                    <Badge variant="outline" className="text-[9px]">
                                      Reversed
                                    </Badge>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2"
                                      title="Reverse allocation"
                                      onClick={() => setReversalAllocation(allocation)}
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatINR(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              payment.status === "received"
                                ? "outline"
                                : "destructive"
                            }
                            className="uppercase text-[10px]"
                          >
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payment.status === "received" && (
                            <div className="flex justify-end gap-1">
                              {getUnallocatedAmount(payment, allocations) >
                                0.009 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setAllocationPayment(payment)
                                    }
                                  >
                                    Allocate
                                  </Button>
                                )}
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Cancel receipt"
                                onClick={() =>
                                  setCancellationPayment(payment)
                                }
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {receiptOpen && (
        <RecordReceiptDialog
          open={receiptOpen}
          customers={customers}
          onClose={() => setReceiptOpen(false)}
          onSaved={refreshData}
        />
      )}

      {allocationPayment && (
        <AllocatePaymentDialog
          payment={allocationPayment}
          invoices={outstanding}
          allocations={allocations}
          onClose={() => setAllocationPayment(null)}
          onSaved={refreshData}
        />
      )}

      {reversalAllocation && (
        <ReverseAllocationDialog
          allocation={reversalAllocation}
          onClose={() => setReversalAllocation(null)}
          onSaved={refreshData}
        />
      )}

      {cancellationPayment && (
        <CancelPaymentDialog
          payment={cancellationPayment}
          allocations={allocations}
          onClose={() => setCancellationPayment(null)}
          onSaved={refreshData}
        />
      )}
    </>
  );
}

function RecordReceiptDialog({
  open,
  customers,
  onClose,
  onSaved,
}: {
  open: boolean;
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [customerText, setCustomerText] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(localDate());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsedAmount = Number(amount);

    if (!customerId) {
      toast.error("Select an existing customer.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }

    if (!date) {
      toast.error("Select the receipt date.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.rpc("record_customer_payment", {
        p_customer_id: customerId,
        p_amount: parsedAmount,
        p_payment_date: date,
        p_mode: mode,
        p_reference: reference.trim() || undefined,
        p_notes: notes.trim() || undefined,
        p_auto_allocate: false,
      });

      if (error) throw error;

      toast.success("Customer receipt recorded.");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not record receipt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Customer Receipt</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <TypeaheadInput
              value={customerText}
              onChange={(value) => {
                setCustomerText(value);
                setCustomerId("");
              }}
              options={customers.map((customer) => ({
                id: customer.id,
                label: customer.customer_name,
                sublabel: [
                  customer.company_name,
                  customer.mobile,
                  customer.gst_number,
                ]
                  .filter(Boolean)
                  .join(" • "),
              }))}
              onSelect={(option) => {
                setCustomerId(option.id);
                setCustomerText(option.label);
              }}
              placeholder="Search and select a customer"
            />
            {!customerId && customerText.trim() && (
              <p className="text-xs text-destructive">
                Select a customer from the suggestions.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Enter amount"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Receipt Date *</Label>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Reference / Transaction No.</Label>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="UTR / Cheque / UPI ref"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional receipt notes"
            />
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Wallet className="h-4 w-4" />
              Receipt allocation
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              This receipt will be recorded against the customer only.
              It will not automatically be applied to any invoice.
              You can allocate it to one or more invoices afterwards.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Record Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AllocatePaymentDialog({
  payment,
  invoices,
  allocations,
  onClose,
  onSaved,
}: {
  payment: Payment;
  invoices: Invoice[];
  allocations: Allocation[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = getUnallocatedAmount(payment, allocations);

  const customerInvoices = invoices.filter(
    (invoice) =>
      invoice.customer_id === payment.customer_id &&
      getInvoiceDue(invoice) > 0,
  );

  const selectedInvoice = customerInvoices.find(
    (invoice) => invoice.id === invoiceId,
  );

  const invoiceDue = selectedInvoice ? getInvoiceDue(selectedInvoice) : 0;
  const maximum = Math.min(remaining, invoiceDue);

  const selectInvoice = (id: string) => {
    setInvoiceId(id);
    const invoice = customerInvoices.find((item) => item.id === id);

    if (invoice) {
      setAmount(
        Math.min(remaining, getInvoiceDue(invoice)).toFixed(2),
      );
    } else {
      setAmount("");
    }
  };

  const save = async () => {
    const parsedAmount = Number(amount);

    if (!invoiceId || !selectedInvoice) {
      toast.error("Select an invoice.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid allocation amount.");
      return;
    }

    if (parsedAmount > remaining + 0.001) {
      toast.error(
        `Allocation cannot exceed the unallocated receipt balance (${formatINR(remaining)}).`,
      );
      return;
    }

    if (parsedAmount > invoiceDue + 0.001) {
      toast.error(
        `Allocation cannot exceed the invoice outstanding amount (${formatINR(invoiceDue)}).`,
      );
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("payment_allocations")
        .insert({
          payment_id: payment.id,
          invoice_id: invoiceId,
          allocated_amount: parsedAmount,
        });

      if (error) throw error;

      await logInvoiceEvent(
        invoiceId,
        "payment_received",
        `Receipt allocation of ${formatINR(parsedAmount)} from receipt ${payment.id}`,
        {
          payment_id: payment.id,
          allocated_amount: parsedAmount,
          payment_mode: payment.mode,
          reference: payment.reference,
        },
      );

      toast.success("Payment allocated to invoice.");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not allocate payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allocate Customer Receipt</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Customer</span>
              <span className="text-right font-medium">
                {getCustomerName(payment.customers)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Receipt Amount</span>
              <span className="tabular-nums">
                {formatINR(payment.amount)}
              </span>
            </div>
            <div className="mt-1 flex justify-between font-semibold">
              <span>Available to Allocate</span>
              <span className="tabular-nums">{formatINR(remaining)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tax Invoice *</Label>
            <Select value={invoiceId} onValueChange={selectInvoice}>
              <SelectTrigger>
                <SelectValue placeholder="Select an outstanding invoice" />
              </SelectTrigger>
              <SelectContent>
                {customerInvoices.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {billNo(invoice.invoice_number)} —{" "}
                    {formatINR(getInvoiceDue(invoice))} due
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {customerInvoices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                This customer has no outstanding tax invoices.
              </p>
            )}
          </div>

          {selectedInvoice && (
            <div className="rounded-md border p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Total</span>
                <span>{formatINR(selectedInvoice.grand_total)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Already Allocated</span>
                <span>{formatINR(selectedInvoice.amount_paid)}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold">
                <span>Outstanding</span>
                <span>{formatINR(invoiceDue)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Maximum allocation</span>
                <span>{formatINR(maximum)}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Allocation Amount *</Label>
            <Input
              type="number"
              min="0.01"
              max={maximum}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter allocation amount"
              disabled={!selectedInvoice}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || !selectedInvoice || maximum <= 0}
          >
            {saving ? "Allocating…" : "Allocate Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReverseAllocationDialog({
  allocation,
  onClose,
  onSaved,
}: {
  allocation: Allocation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const reverse = async () => {
    if (!reason.trim()) {
      toast.error("Enter a reason for reversing this allocation.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("payment_allocations")
        .update({
          status: "reversed",
          reversal_reason: reason.trim(),
        })
        .eq("id", allocation.id)
        .eq("status", "active");

      if (error) throw error;

      await logInvoiceEvent(
        allocation.invoice_id,
        "adjustment",
        `Payment allocation of ${formatINR(allocation.allocated_amount)} reversed: ${reason.trim()}`,
        {
          allocation_id: allocation.id,
          payment_id: allocation.payment_id,
          reversal_reason: reason.trim(),
        },
      );

      toast.success("Payment allocation reversed.");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not reverse allocation.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse Payment Allocation</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-mono">
                {billNo(allocation.invoices?.invoice_number)}
              </span>
            </div>
            <div className="mt-1 flex justify-between font-semibold">
              <span>Allocation Amount</span>
              <span>{formatINR(allocation.allocated_amount)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Reason for Reversal *</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this allocation is being reversed."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={reverse}
            disabled={saving || !reason.trim()}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {saving ? "Reversing…" : "Reverse Allocation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelPaymentDialog({
  payment,
  allocations,
  onClose,
  onSaved,
}: {
  payment: Payment;
  allocations: Allocation[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const activeAllocations = allocations.filter(
    (allocation) =>
      allocation.payment_id === payment.id &&
      allocation.status === "active",
  );

  const cancel = async () => {
    if (!reason.trim()) {
      toast.error("Enter a reason for cancelling this receipt.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from("payments")
        .update({
          status: "cancelled",
          cancellation_reason: reason.trim(),
        })
        .eq("id", payment.id)
        .eq("status", "received");

      if (error) throw error;

      for (const allocation of activeAllocations) {
        await logInvoiceEvent(
          allocation.invoice_id,
          "adjustment",
          `Receipt ${payment.id} cancelled. Its allocation of ${formatINR(allocation.allocated_amount)} is no longer counted: ${reason.trim()}`,
          {
            payment_id: payment.id,
            allocation_id: allocation.id,
            cancellation_reason: reason.trim(),
          },
        );
      }

      toast.success("Receipt cancelled. Its allocations are no longer counted as paid.");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not cancel receipt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(value) => !value && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Customer Receipt</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Customer</span>
              <span>{getCustomerName(payment.customers)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Receipt Amount</span>
              <span className="font-semibold">
                {formatINR(payment.amount)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Active Allocations</span>
              <span>{activeAllocations.length}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Cancelling this receipt will cause its allocations to stop
            contributing to invoice paid amounts. The receipt and allocation
            records will remain in the system for audit purposes.
          </p>

          <div className="space-y-1.5">
            <Label>Cancellation Reason *</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this receipt is being cancelled."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Keep Receipt
          </Button>
          <Button
            variant="destructive"
            onClick={cancel}
            disabled={saving || !reason.trim()}
          >
            {saving ? "Cancelling…" : "Confirm Cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 w-1 ${accent === "warning" ? "bg-warning" : "bg-primary"
          }`}
      />
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
