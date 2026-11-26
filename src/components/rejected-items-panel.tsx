import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatINR, amountInWords } from "@/lib/format";
import { logInvoiceEvent } from "@/lib/invoice-history";
import { toast } from "sonner";

const REASONS = [
  "Manufacturing Defect",
  "Customer Rejection",
  "Wrong Size",
  "Wrong Material",
  "Other",
];

export function RejectedItemsPanel({
  invoiceId,
  items,
  invoice,
  disabled,
}: {
  invoiceId: string;
  items: any[];
  invoice: any;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const { data: rejections = [] } = useQuery({
    queryKey: ["rejections", invoiceId],
    queryFn: async () => {
      const { data } = await (supabase.from("invoice_rejections") as any)
        .select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Per-item rejected totals so far
  const rejectedByItem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rejections) m[r.invoice_item_id] = (m[r.invoice_item_id] ?? 0) + Number(r.rejected_quantity);
    return m;
  }, [rejections]);

  const [drafts, setDrafts] = useState<Record<string, { qty: string; reason: string; notes: string; disposition: string }>>({});
  const setD = (id: string, patch: any) => setDrafts((s) => {
    const prev = s[id] ?? { qty: "", reason: "", notes: "", disposition: "restock" };
    return { ...s, [id]: { ...prev, ...patch } };
  });

  const [saving, setSaving] = useState(false);

  const save = async () => {
    const entries = Object.entries(drafts).filter(([, d]) => Number(d.qty) > 0 && d.reason);
    if (entries.length === 0) return toast.error("Enter a quantity and reason for at least one item.");
    setSaving(true);

    const inserts: any[] = [];
    let totalDeduction = 0;
    for (const [itemId, d] of entries) {
      const item = items.find((i) => i.id === itemId);
      if (!item) continue;
      const alreadyRejected = rejectedByItem[itemId] ?? 0;
      const qty = Number(d.qty);
      const maxAvailable = Number(item.quantity) - alreadyRejected;
      if (qty > maxAvailable) {
        toast.error(`${item.description}: only ${maxAvailable} left to reject.`);
        setSaving(false);
        return;
      }
      const unitRate = Number(item.unit_rate);
      const taxPct = Number(item.tax_pct);
      const rejectedValue = qty * unitRate;
      const gstDeduction = (rejectedValue * taxPct) / 100;
      const total = rejectedValue + gstDeduction;
      totalDeduction += total;
      inserts.push({
        invoice_id: invoiceId,
        invoice_item_id: itemId,
        rejected_quantity: qty,
        rejection_reason: d.reason,
        reason_notes: d.notes || null,
        unit_rate: unitRate,
        tax_pct: taxPct,
        rejected_value: rejectedValue,
        gst_deduction: gstDeduction,
        total_deduction: total,
        disposition: d.disposition || "restock",
      });
    }

    const { data: rejData, error } = await (supabase.from("invoice_rejections") as any).insert(inserts).select("*");
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    const newRejectedByItem: Record<string, number> = { ...rejectedByItem };
    for (const [itemId, d] of entries) {
      newRejectedByItem[itemId] = (newRejectedByItem[itemId] ?? 0) + Number(d.qty);
    }
    for (const item of items) {
      const newRejected = newRejectedByItem[item.id] ?? 0;
      const accepted = Number(item.quantity) - newRejected;
      const gross = accepted * Number(item.unit_rate);
      const discountAmount = (gross * Number(item.discount_pct ?? 0)) / 100;
      const net = gross - discountAmount;
      const taxAmount = (net * Number(item.tax_pct ?? 0)) / 100;
      await (supabase.from("invoice_items") as any).update({
        rejected_quantity: newRejected,
        accepted_quantity: accepted,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: net + taxAmount,
      }).eq("id", item.id);
    }

    // Create customer credit entry
    if (totalDeduction > 0) {
      await (supabase.from("customer_credits") as any).insert({
        customer_id: invoice.customer_id,
        source_invoice_id: invoiceId,
        source_rejection_id: rejData?.[0]?.id ?? null,
        credit_amount: totalDeduction,
        notes: `Auto-generated from rejected items on ${invoice.invoice_number}`,
      });
    }

    // Rejected inventory rows for defect dispositions
    const inventoryInserts = entries
      .filter(([, d]) => d.disposition === "rejected_inventory")
      .map(([itemId, d]) => {
        const item = items.find((i) => i.id === itemId)!;
        return {
          product_id: item.product_id ?? null,
          invoice_id: invoiceId,
          description: item.description,
          quantity: Number(d.qty),
          uom: item.uom,
          reason: d.reason,
          disposition: "hold",
        };
      });
    if (inventoryInserts.length) await (supabase.from("rejected_inventory") as any).insert(inventoryInserts);

    await logInvoiceEvent(invoiceId, "rejected_items",
      `${entries.length} item(s) rejected, deduction ${formatINR(totalDeduction)}`,
      { deduction: totalDeduction, count: entries.length });

    // Recompute the whole invoice from accepted quantities so line items,
    // net value, sub total and taxes stay consistent with the grand total.
    const originalItemDiscounts = items.reduce((s, i) => s + Number(i.discount_amount ?? 0), 0);
    const extraDiscount = Number(invoice.discount_amount ?? 0) - originalItemDiscounts;
    let netValue = 0, taxTotal = 0, itemDiscounts = 0;
    for (const item of items) {
      const accepted = Number(item.quantity) - (newRejectedByItem[item.id] ?? 0);
      const gross = accepted * Number(item.unit_rate);
      const discountAmount = (gross * Number(item.discount_pct ?? 0)) / 100;
      const net = gross - discountAmount;
      itemDiscounts += discountAmount;
      netValue += net;
      taxTotal += (net * Number(item.tax_pct ?? 0)) / 100;
    }
    const charges = Number(invoice.freight ?? 0) + Number(invoice.packing_charges ?? 0) + Number(invoice.other_charges ?? 0);
    const newSubtotal = netValue + charges - extraDiscount;
    const preRound = newSubtotal + taxTotal;
    const newGrand = Math.round(preRound);
    await (supabase.from("invoices") as any).update({
      net_value: netValue,
      discount_amount: itemDiscounts + extraDiscount,
      subtotal: newSubtotal,
      sgst_amount: invoice.is_igst ? 0 : taxTotal / 2,
      cgst_amount: invoice.is_igst ? 0 : taxTotal / 2,
      igst_amount: invoice.is_igst ? taxTotal : 0,
      round_off: newGrand - preRound,
      grand_total: newGrand,
      amount_in_words: amountInWords(newGrand),
    }).eq("id", invoiceId);
    await logInvoiceEvent(invoiceId, "adjustment", `Invoice recalculated after rejection, reduced by ${formatINR(totalDeduction)}`, { newGrand });

    setSaving(false);
    setDrafts({});
    toast.success("Rejection recorded and credit generated");
    qc.invalidateQueries({ queryKey: ["rejections", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  };

  const summary = useMemo(() => {
    const totalRejected = rejections.reduce((s: number, r: any) => s + Number(r.total_deduction), 0);
    return { totalRejected, count: rejections.length };
  }, [rejections]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage Returned / Rejected Items</CardTitle>
          <CardDescription>
            Enter rejected quantity and reason. System automatically calculates deduction, creates customer credit, and updates inventory.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Already Rejected</TableHead>
                <TableHead>Reject Qty</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Disposition</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it: any) => {
                const already = rejectedByItem[it.id] ?? 0;
                const remaining = Number(it.quantity) - already;
                const d = drafts[it.id] ?? { qty: "", reason: "", notes: "", disposition: "restock" };
                return (
                  <TableRow key={it.id}>
                    <TableCell className="max-w-[250px] truncate">{it.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(it.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{already}</TableCell>
                    <TableCell>
                      <Input
                        type="number" min={0} max={remaining} step="0.01"
                        value={d.qty}
                        onChange={(e) => setD(it.id, { qty: e.target.value })}
                        disabled={disabled || remaining <= 0}
                        placeholder={`max ${remaining}`}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={d.reason} onValueChange={(v) => setD(it.id, { reason: v })} disabled={disabled}>
                        <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Select…" /></SelectTrigger>
                        <SelectContent>
                          {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={d.disposition} onValueChange={(v) => setD(it.id, { disposition: v })} disabled={disabled}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="restock">Back to Stock</SelectItem>
                          <SelectItem value="rejected_inventory">Rejected Inventory</SelectItem>
                          <SelectItem value="scrap">Scrap</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input value={d.notes} onChange={(e) => setD(it.id, { notes: e.target.value })} disabled={disabled} className="h-8" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving || disabled}>{saving ? "Saving…" : "Save Rejection & Adjust Invoice"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rejection History</CardTitle>
          <CardDescription>
            {summary.count} rejection{summary.count === 1 ? "" : "s"} • Total deduction: <span className="font-semibold">{formatINR(summary.totalRejected)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rejections.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No rejections recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total Deduction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejections.map((r: any) => {
                  const item = items.find((i) => i.id === r.invoice_item_id);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{item?.description ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(r.rejected_quantity)}</TableCell>
                      <TableCell>{r.rejection_reason}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.rejected_value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatINR(r.gst_deduction)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{formatINR(r.total_deduction)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}