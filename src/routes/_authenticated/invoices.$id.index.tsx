import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate, amountInWords, billNo } from "@/lib/format";
import { ArrowLeft, Printer, Copy, Send, Pencil, Ban, PackageX, History as HistoryIcon } from "lucide-react";
import aewLogo from "@/assets/aew-logo.jpg";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CancelInvoiceDialog } from "@/components/cancel-invoice-dialog";
import { logInvoiceEvent } from "@/lib/invoice-history";
import { InvoiceHistoryTab } from "@/components/invoice-history-tab";
import { RejectedItemsPanel } from "@/components/rejected-items-panel";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { downloadInvoicePdf } from "@/lib/invoice-pdf-download.functions";
import { useState } from "react";
import { isSalesDocumentKind, salesDocumentConfig, type SalesDocumentKind } from "@/lib/sales-documents";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/invoices/$id/")({
  validateSearch: (search: Record<string, unknown>): { kind?: SalesDocumentKind } => {
    const k = typeof search.kind === "string" ? search.kind : "";
    return isSalesDocumentKind(k) ? { kind: k } : {};
  },
  head: () => ({ meta: [{ title: "Document — ABJAD ERP" }] }),
  component: InvoiceDetail,
});

const typeLabels: Record<string, string> = {
  tax_invoice: "TAX INVOICE",
  proforma: "PROFORMA INVOICE",
  quotation: "QUOTATION",
  delivery_challan: "DELIVERY CHALLAN",
  credit_note: "CREDIT NOTE",
  debit_note: "DEBIT NOTE",
};

function InvoiceDetail() {
  const { id } = Route.useParams();
  const kind: SalesDocumentKind = Route.useSearch().kind ?? "tax_invoice";
  const cfg = salesDocumentConfig(kind);
  const docTable = cfg.table as "invoices";
  const itemsTable = cfg.itemsTable as "invoice_items";
  const isTax = kind === "tax_invoice";
  const nav = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const getPdf = useServerFn(downloadInvoicePdf);
  const [downloading, setDownloading] = useState(false);
  const { canPerform } = useAuth();

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res: any = await getPdf({ data: { invoiceId: id, kind } });
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate the invoice PDF");
    } finally {
      setDownloading(false);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", kind, id],
    queryFn: async () => {
      const [inv, items, company] = await Promise.all([
        supabase.from(docTable).select("*").eq("id", id).single(),
        supabase.from(itemsTable).select("*").eq("invoice_id", id).order("sr_no"),
        supabase.from("company_profile").select("*").limit(1).maybeSingle(),
      ]);
      if (inv.error) throw inv.error;
      const rows = (items.data ?? []) as any[];
      const invoice = inv.data as any;

      // Self-heal stored snapshots for invoices whose rejections were saved
      // before totals were recalculated (only grand_total was adjusted then).
      if (isTax && invoice && rows.some((it) => Number(it.rejected_quantity ?? 0) > 0)) {
        let netValue = 0, itemDiscounts = 0, taxTotal = 0;
        for (const it of rows) {
          const accepted = Number(it.quantity) - Number(it.rejected_quantity ?? 0);
          const gross = accepted * Number(it.unit_rate);
          const discount = (gross * Number(it.discount_pct ?? 0)) / 100;
          const net = gross - discount;
          const tax = (net * Number(it.tax_pct ?? 0)) / 100;
          netValue += net; itemDiscounts += discount; taxTotal += tax;
          const lineTotal = net + tax;
          if (Math.abs(Number(it.total_amount ?? 0) - lineTotal) > 0.01) {
            await supabase.from(itemsTable).update({
              accepted_quantity: accepted,
              discount_amount: discount,
              tax_amount: tax,
              total_amount: lineTotal,
            }).eq("id", it.id);
            it.accepted_quantity = accepted;
            it.discount_amount = discount;
            it.tax_amount = tax;
            it.total_amount = lineTotal;
          }
        }
        const charges = Number(invoice.freight ?? 0) + Number(invoice.packing_charges ?? 0) + Number(invoice.other_charges ?? 0);
        const subtotal = netValue + charges;
        const preRound = subtotal + taxTotal;
        const grand = Math.round(preRound);
        const next = {
          net_value: netValue,
          discount_amount: itemDiscounts,
          subtotal,
          sgst_amount: invoice.is_igst ? 0 : taxTotal / 2,
          cgst_amount: invoice.is_igst ? 0 : taxTotal / 2,
          igst_amount: invoice.is_igst ? taxTotal : 0,
          round_off: grand - preRound,
          grand_total: grand,
          amount_in_words: amountInWords(grand),
        };
        if (Math.abs(Number(invoice.subtotal ?? 0) - subtotal) > 0.01 ||
          Math.abs(Number(invoice.grand_total ?? 0) - grand) > 0.01) {
          await supabase.from(docTable).update(next).eq("id", id);
          Object.assign(invoice, next);
        }
      }

      return { invoice, items: rows, company: company.data };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!data?.invoice) return <div className="text-muted-foreground">Invoice not found.</div>;

  const { invoice, items, company } = data;
  const typeLabel = typeLabels[invoice.invoice_type] ?? "TAX INVOICE";
  const isCancelled = invoice.status === "cancelled";

  const duplicate = async () => {
    const duplicatePayload: any = {
      invoice_number: `${invoice.invoice_number}-COPY-${Date.now().toString().slice(-4)}`,
      invoice_type: invoice.invoice_type,
      invoice_date: new Date().toISOString().slice(0, 10),
      customer_id: invoice.customer_id,
      customer_name_snapshot: invoice.customer_name_snapshot,
      customer_gst_snapshot: invoice.customer_gst_snapshot,
      customer_address_snapshot: invoice.customer_address_snapshot,
      work_order_number: invoice.work_order_number,
      delivery_mode: invoice.delivery_mode,
      contact_person: invoice.contact_person,
      contact_mobile: invoice.contact_mobile,
      notes: invoice.notes,
      status: "draft",
    };
    if (kind === "delivery_challan") {
      Object.assign(duplicatePayload, {
        challan_number: invoice.challan_number,
        challan_date: invoice.challan_date,
        challan_dates: invoice.challan_dates,
        movement_reason: invoice.movement_reason,
        transporter_name: invoice.transporter_name,
        place_of_dispatch: invoice.place_of_dispatch,
        place_of_delivery: invoice.place_of_delivery,
      });
    } else {
      Object.assign(duplicatePayload, {
        is_igst: invoice.is_igst,
        net_value: invoice.net_value,
        discount_amount: invoice.discount_amount,
        freight: invoice.freight,
        packing_charges: invoice.packing_charges,
        other_charges: invoice.other_charges,
        transportation_charges: invoice.transportation_charges,
        delivery_charges: invoice.delivery_charges,
        subtotal: invoice.subtotal,
        sgst_amount: invoice.sgst_amount,
        cgst_amount: invoice.cgst_amount,
        igst_amount: invoice.igst_amount,
        round_off: invoice.round_off,
        grand_total: invoice.grand_total,
        amount_in_words: invoice.amount_in_words,
        payment_terms: invoice.payment_terms,
      });
    }
    const { data: newInv, error } = await supabase.from(docTable).insert(duplicatePayload).select("id").single();
    if (error) return toast.error(error.message);
    if (items.length && newInv) {
      await supabase.from(itemsTable).insert(items.map((it: any) => {
        const base = {
          invoice_id: newInv.id,
          sr_no: it.sr_no,
          product_id: it.product_id,
          hsn_code: it.hsn_code,
          description: it.description,
          quantity: it.quantity,
          uom: it.uom,
          serial_batch_number: it.serial_batch_number,
        };
        return kind === "delivery_challan" ? base : {
          ...base,
          unit_rate: it.unit_rate,
          discount_pct: it.discount_pct,
          discount_amount: it.discount_amount,
          tax_pct: it.tax_pct,
          tax_amount: it.tax_amount,
          total_amount: it.total_amount,
        };
      }));
    }
    if (newInv && isTax) await logInvoiceEvent(newInv.id, "duplicated", `Duplicated from ${invoice.invoice_number}`);
    toast.success(`${cfg.label} duplicated as draft`);
    nav({ to: "/invoices/$id", params: { id: newInv!.id }, search: { kind } });
  };

  const markSent = async () => {
    const { error } = await supabase.from(docTable).update({ status: "sent" }).eq("id", id);
    if (error) return toast.error(error.message);
    if (isTax) await logInvoiceEvent(id, "sent", "Marked as sent");
    toast.success("Marked as sent");
    qc.invalidateQueries({ queryKey: ["invoice", kind, id] });
  };

  const cancelOther = async () => {
    if (!window.confirm(`Cancel this ${cfg.label.toLowerCase()}?`)) return;
    const { error } = await supabase.from(docTable).update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`${cfg.label} cancelled`);
    qc.invalidateQueries({ queryKey: ["invoice", kind, id] });
  };

  return (
    <>
      {/* Toolbar — hidden on print */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-wrap gap-2">
          {isCancelled && <Badge variant="outline" className="border-destructive bg-destructive/10 text-destructive uppercase">Cancelled</Badge>}
          {isTax && invoice.is_imported && <Badge variant="outline" className="uppercase">Imported</Badge>}
          {invoice.status === "draft" && !isCancelled && (
            <Button variant="outline" size="sm" onClick={markSent}><Send className="mr-1 h-4 w-4" /> Mark Sent</Button>
          )}
          {!isCancelled && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/invoices/$id/edit" params={{ id }} search={{ kind }}><Pencil className="mr-1 h-4 w-4" /> Edit</Link>
            </Button>
          )}
          {canPerform(kind, "duplicate") && (
            <Button variant="outline" size="sm" onClick={duplicate}><Copy className="mr-1 h-4 w-4" /> Duplicate</Button>
          )}
          {!isCancelled && !isTax && canPerform(kind, "cancel") && (
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={cancelOther}><Ban className="mr-1 h-4 w-4" /> Cancel</Button>
          )}
          {!isCancelled && isTax && canPerform(kind, "cancel") && (
            <CancelInvoiceDialog
              invoiceId={id}
              invoiceNumber={billNo(invoice.invoice_number)}
              onCancelled={() => qc.invalidateQueries({ queryKey: ["invoice", kind, id] })}
              trigger={
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Ban className="mr-1 h-4 w-4" /> Cancel Invoice</Button>
              }
            />
          )}
          {canPerform(kind, "download_pdf") && (
            <Button size="sm" onClick={downloadPdf} disabled={downloading}><Printer className="mr-1 h-4 w-4" /> {downloading ? "Preparing…" : "Download PDF"}</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="invoice" className="print:contents">
        <TabsList className="print:hidden">
          <TabsTrigger value="invoice">{isTax ? "Invoice" : cfg.label}</TabsTrigger>
          {isTax && <TabsTrigger value="rejected"><PackageX className="mr-1 h-3.5 w-3.5" /> Rejected Items</TabsTrigger>}
          {isTax && <TabsTrigger value="history"><HistoryIcon className="mr-1 h-3.5 w-3.5" /> History</TabsTrigger>}
        </TabsList>
        <TabsContent value="invoice" className="print:block">
          <div className={`print-page relative mx-auto bg-white text-black shadow-sm print:shadow-none ${isCancelled ? "cancelled-invoice" : ""}`} style={{ maxWidth: "210mm", padding: "10mm" }}>
            {isCancelled && (
              <div className="cancelled-watermark pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <span className="select-none text-[140px] font-extrabold uppercase tracking-widest opacity-20" style={{ color: "#dc2626", transform: "rotate(-25deg)", border: "8px solid #dc2626", padding: "0 24px" }}>Cancelled</span>
              </div>
            )}
            {kind === "delivery_challan" ? (
              <PrintableChallan invoice={invoice} items={items} company={company} />
            ) : (
              <PrintableInvoice invoice={invoice} items={items} company={company} typeLabel={typeLabel} />
            )}
          </div>
        </TabsContent>
        <TabsContent value="rejected" className="print:hidden">
          <RejectedItemsPanel invoiceId={id} items={items} invoice={invoice} disabled={isCancelled} />
        </TabsContent>
        <TabsContent value="history" className="print:hidden">
          <InvoiceHistoryTab invoiceId={id} />
        </TabsContent>
      </Tabs>

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: white !important; }
          .print-page { box-shadow: none !important; max-width: 100% !important; padding: 0 !important; }
          [role="tablist"] { display: none !important; }
        }
      `}</style>
    </>
  );
}

function PrintableChallan({ invoice, items, company }: { invoice: any; items: any[]; company: any }) {
  const c = company ?? {};
  const border = "border border-black";
  const dates = Array.isArray(invoice.challan_dates) && invoice.challan_dates.length
    ? invoice.challan_dates.map((date: string) => formatDate(date)).join(", ")
    : formatDate(invoice.challan_date ?? invoice.invoice_date);

  return (
    <div className="text-[11px] text-black" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div className="flex items-start justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl font-bold">{c.name ?? "ABJAD ENGINEERING WORKS"}</h1>
          <div>{[c.address, c.city, c.state, c.pincode].filter(Boolean).join(", ")}</div>
          <div>GSTIN: {c.gst_number ?? "—"}</div>
          <div>{[c.mobile, c.alt_mobile, c.email].filter(Boolean).join(" • ")}</div>
        </div>
        <img src={aewLogo} alt="AEW logo" className="h-20 w-auto object-contain" />
      </div>
      <h2 className="bg-primary py-2 text-center text-xl font-bold text-primary-foreground">DELIVERY CHALLAN</h2>

      <div className="grid grid-cols-2">
        <section className={`${border} p-2`}>
          <h3 className="font-bold">DOCUMENT DETAILS</h3>
          <div>Challan No.: {invoice.challan_number ?? invoice.invoice_number}</div>
          <div>Date: {dates}</div>
          <div>Reason: {invoice.movement_reason ?? "—"}</div>
        </section>
        <section className={`${border} p-2`}>
          <h3 className="font-bold">CONSIGNEE</h3>
          <div>{invoice.customer_name_snapshot ?? "—"}</div>
          <div className="whitespace-pre-line">{invoice.customer_address_snapshot ?? "—"}</div>
          <div>GSTIN: {invoice.customer_gst_snapshot ?? "—"}</div>
        </section>
      </div>
      <section className={`${border} p-2`}>
        <h3 className="font-bold">TRANSPORT</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>Transporter: {invoice.transporter_name ?? "—"}</div>
          <div>Dispatch: {invoice.place_of_dispatch ?? "—"}</div>
          <div>Delivery: {invoice.place_of_delivery ?? "—"}</div>
        </div>
      </section>
      <table className="w-full border-collapse">
        <thead><tr>
          {['Sr. No.', 'Item', 'HSN', 'Description', 'Quantity', 'UOM', 'Serial / Batch'].map((head) => (
            <th key={head} className={`${border} p-1 text-left`}>{head}</th>
          ))}
        </tr></thead>
        <tbody>{items.map((item) => (
          <tr key={item.id}>
            <td className={`${border} p-1`}>{item.sr_no}</td>
            <td className={`${border} p-1`}>{item.description}</td>
            <td className={`${border} p-1`}>{item.hsn_code ?? ""}</td>
            <td className={`${border} p-1`}>{item.description}</td>
            <td className={`${border} p-1 text-right`}>{Number(item.quantity)}</td>
            <td className={`${border} p-1`}>{item.uom ?? "NOS"}</td>
            <td className={`${border} p-1`}>{item.serial_batch_number ?? ""}</td>
          </tr>
        ))}</tbody>
      </table>
      {invoice.notes && <div className={`${border} p-2`}>Notes: {invoice.notes}</div>}
      <section className={`${border} mt-4 p-3`}>
        <h3 className="font-bold">RECEIVER ACKNOWLEDGEMENT</h3>
        <p>Received the above goods in good condition.</p>
        <div className="mt-10 grid grid-cols-4 gap-4"><span>Receiver Name</span><span>Signature</span><span>Date</span><span>Company Stamp</span></div>
      </section>
    </div>
  );
}

function PrintableInvoice({ invoice, items, company, typeLabel }: { invoice: any; items: any[]; company: any; typeLabel: string }) {
  const c = company ?? {};
  const cellBorder = "border border-black";
  const label = "font-bold text-[11px]";
  const val = "text-[11px]";

  // Totals are always derived from the accepted (delivered minus rejected)
  // quantities so the invoice stays internally consistent, including for
  // rejections recorded before totals were recalculated on save.
  const lineTotals: Record<string, number> = {};
  let netValue = 0;
  let itemDiscounts = 0;
  let taxTotal = 0;
  for (const it of items) {
    const accepted = Number(it.quantity) - Number(it.rejected_quantity ?? 0);
    const gross = accepted * Number(it.unit_rate);
    const discount = (gross * Number(it.discount_pct ?? 0)) / 100;
    const net = gross - discount;
    const tax = (net * Number(it.tax_pct ?? 0)) / 100;
    lineTotals[it.id] = net + tax;
    netValue += net;
    itemDiscounts += discount;
    taxTotal += tax;
  }
  const charges =
    Number(invoice.freight ?? 0) + Number(invoice.packing_charges ?? 0) + Number(invoice.other_charges ?? 0);
  const subtotal = netValue + charges;
  const preRound = subtotal + taxTotal;
  const grandTotal = Math.round(preRound);
  const totals = {
    netValue,
    discount: itemDiscounts,
    subtotal,
    sgst: invoice.is_igst ? 0 : taxTotal / 2,
    cgst: invoice.is_igst ? 0 : taxTotal / 2,
    igst: invoice.is_igst ? taxTotal : 0,
    roundOff: grandTotal - preRound,
    grandTotal,
  };

  return (
    <div className="font-serif text-black" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 pb-2">
        <div className="flex-1">
          <h1 className="text-xl font-bold underline">{c.name ?? "ABJAD ENGINEERING WORKS"}</h1>
          <div className="mt-1 text-[11px] leading-snug">
            <span className="underline font-semibold">OFFICE &amp; WORKS:</span>{" "}
            {c.address ?? "UNIT NO. 008, G-WING, UDYOG BHAVAN -2, PLOT NO. K-3, MIDC ANAND NAGER AMBERNATH (E) PIN 421 506"}
            {c.city && <>, {c.city}</>}
            {c.state && <> ({c.state})</>}
            {(c.mobile || c.alt_mobile) && <>, {c.mobile}{c.alt_mobile ? ` / ${c.alt_mobile}` : ""}</>}
            {c.email && <div className="italic text-blue-700">Email: {c.email}</div>}
          </div>
        </div>
        <img src={aewLogo} alt="AEW logo" className="h-20 w-auto object-contain" />
      </div>

      {/* TITLE BANNER */}
      <div className="my-1 bg-[#5b9bd5] py-1.5 text-center">
        <h2 className="text-2xl font-bold tracking-wider text-white">{typeLabel}</h2>
      </div>

      {/* CUSTOMER + BILL META */}
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          <tr>
            <td className={`${cellBorder} p-1 ${label} w-[15%] align-top`}>CUSTOMER NAME</td>
            <td className={`${cellBorder} p-1 ${val} w-[45%] align-top`}>{invoice.customer_name_snapshot ?? "—"}</td>
            <td className={`${cellBorder} p-1 ${label} w-[15%]`}>Bill No.</td>
            <td className={`${cellBorder} p-1 ${val} w-[10%]`}>{billNo(invoice.invoice_number)}</td>
            <td className={`${cellBorder} p-1 ${label} w-[8%]`}>Date</td>
            <td className={`${cellBorder} p-1 ${val} w-[12%]`}>{formatDate(invoice.invoice_date)}</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1 ${label} align-top`}>Address</td>
            <td className={`${cellBorder} p-1 ${val} align-top`} colSpan={5}>{invoice.customer_address_snapshot ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* BUYER + COMPANY DETAILS */}
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          <tr className="bg-gray-100">
            <td className={`${cellBorder} p-1 ${label} text-center`} colSpan={2}>BUYER DETAILS</td>
            <td className={`${cellBorder} p-1 ${label} text-center`} colSpan={2}>COMPANY DETAILS</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1 ${label} w-[15%]`}>GSTIN NO.</td>
            <td className={`${cellBorder} p-1 ${val} w-[35%]`}>{invoice.customer_gst_snapshot ?? ""}</td>
            <td className={`${cellBorder} p-1 ${label} w-[15%]`}>GSTIN NO.</td>
            <td className={`${cellBorder} p-1 ${val} w-[35%]`}>{c.gst_number ?? ""}</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1 ${label}`}>W/O No.</td>
            <td className={`${cellBorder} p-1 ${val}`}>{invoice.work_order_number ?? ""}</td>
            <td className={`${cellBorder} p-1 ${label}`}>PAN NO.</td>
            <td className={`${cellBorder} p-1 ${val}`}>{c.pan_number ?? ""}</td>
          </tr>
        </tbody>
      </table>

      {/* LINE ITEMS */}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            <th className={`${cellBorder} p-1 w-[6%]`}>Sr. No.</th>
            <th className={`${cellBorder} p-1 w-[10%]`}>HSN /SAC Cod</th>
            <th className={`${cellBorder} p-1 text-left`}>Item Description</th>
            <th className={`${cellBorder} p-1 w-[9%]`}>Qty. (Nos)</th>
            <th className={`${cellBorder} p-1 w-[8%]`}>UOM</th>
            <th className={`${cellBorder} p-1 w-[12%]`}>Unit Rate(Rs)</th>
            <th className={`${cellBorder} p-1 w-[13%]`}>Total Amt.(Rs)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const rejected = Number(it.rejected_quantity ?? 0);
            const billedQty = rejected > 0 ? Number(it.quantity) - rejected : Number(it.quantity);
            return (
              <tr key={it.id}>
                <td className={`${cellBorder} p-1 text-center`}>{it.sr_no}</td>
                <td className={`${cellBorder} p-1 text-center`}>{it.hsn_code ?? ""}</td>
                <td className={`${cellBorder} p-1`}>
                  {it.description}
                  {rejected > 0 && (
                    <span className="text-[10px] italic"> (Delivered {Number(it.quantity)}, rejected {rejected})</span>
                  )}
                </td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>{billedQty.toFixed(0).padStart(2, "0")}</td>
                <td className={`${cellBorder} p-1 text-center`}>{it.uom ?? "NOS"}</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>{Number(it.unit_rate).toFixed(2)}</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>{(lineTotals[it.id] ?? Number(it.total_amount)).toFixed(2)}</td>
              </tr>
            );
          })}
          {/* filler rows */}
          {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => (
            <tr key={`f${i}`}>
              <td className={`${cellBorder} p-1`}>&nbsp;</td>
              <td className={cellBorder}></td>
              <td className={cellBorder}></td>
              <td className={cellBorder}></td>
              <td className={cellBorder}></td>
              <td className={cellBorder}></td>
              <td className={cellBorder}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* BANK + TOTALS */}
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          <tr>
            <td className={`${cellBorder} p-2 align-top`} rowSpan={11} style={{ width: "55%" }}>
              <div className="grid grid-cols-[110px_1fr] gap-y-1 text-[11px]">
                <div className="font-bold">BANK NAME</div><div>{c.bank_name ?? ""}</div>
                <div className="font-bold">A/C NO.</div><div>{c.bank_account ?? ""}</div>
                <div className="font-bold">BRANCH IFSC</div><div>{c.bank_ifsc ?? ""}</div>
                <div className="font-bold">BRANCH NAME</div><div>{c.bank_branch ?? ""}</div>
              </div>
            </td>
            <td className={`${cellBorder} p-1 ${label}`} colSpan={2}>Net Value (Rs.)</td>
            <td className={`${cellBorder} p-1 text-right tabular-nums`}>{totals.netValue.toFixed(2)}</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1`} colSpan={2}>Discount</td>
            <td className={`${cellBorder} p-1 text-right tabular-nums`}>{totals.discount.toFixed(2)}</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1`} colSpan={2}>Freight</td>
            <td className={`${cellBorder} p-1 text-right tabular-nums`}>{Number(invoice.freight).toFixed(2)}</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1`} colSpan={2}>P &amp; F Charges</td>
            <td className={`${cellBorder} p-1 text-right tabular-nums`}>{Number(invoice.packing_charges).toFixed(2)}</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1`} colSpan={2}>Sub Total</td>
            <td className={`${cellBorder} p-1 text-right tabular-nums`}>{totals.subtotal.toFixed(2)}</td>
          </tr>
          {!invoice.is_igst ? (
            <>
              <tr>
                <td className={`${cellBorder} p-1 w-[35%]`}>SGST</td>
                <td className={`${cellBorder} p-1 text-center w-[10%]`}>{items[0]?.tax_pct ? `${Number(items[0].tax_pct) / 2}%` : ""}</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>{totals.sgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td className={`${cellBorder} p-1`}>CGST</td>
                <td className={`${cellBorder} p-1 text-center`}>{items[0]?.tax_pct ? `${Number(items[0].tax_pct) / 2}%` : ""}</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>{totals.cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td className={`${cellBorder} p-1`}>IGST</td>
                <td className={`${cellBorder} p-1 text-center`}>----</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>0.00</td>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <td className={`${cellBorder} p-1`}>SGST</td>
                <td className={`${cellBorder} p-1 text-center`}>----</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>0.00</td>
              </tr>
              <tr>
                <td className={`${cellBorder} p-1`}>CGST</td>
                <td className={`${cellBorder} p-1 text-center`}>----</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>0.00</td>
              </tr>
              <tr>
                <td className={`${cellBorder} p-1`}>IGST</td>
                <td className={`${cellBorder} p-1 text-center`}>{items[0]?.tax_pct ? `${items[0].tax_pct}%` : ""}</td>
                <td className={`${cellBorder} p-1 text-right tabular-nums`}>{totals.igst.toFixed(2)}</td>
              </tr>
            </>
          )}
          <tr>
            <td className={`${cellBorder} p-1`} colSpan={2}>Sub Total</td>
            <td className={`${cellBorder} p-1 text-right tabular-nums`}>{(totals.subtotal + totals.sgst + totals.cgst + totals.igst).toFixed(2)}</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1`} colSpan={2}>Round Off</td>
            <td className={`${cellBorder} p-1 text-right tabular-nums`}>{totals.roundOff.toFixed(2)}</td>
          </tr>
          <tr className="bg-gray-100">
            <td className={`${cellBorder} p-1 font-bold`} colSpan={2}>Grand Total (Rs)</td>
            <td className={`${cellBorder} p-1 text-right font-bold tabular-nums`}>{totals.grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* IN WORDS */}
      <div className={`${cellBorder} border-t-0 p-1 text-[11px] italic`}>
        In Words. {amountInWords(totals.grandTotal)}
      </div>

      {/* FOOTER META + SIGNATURE */}
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          <tr>
            <td className={`${cellBorder} p-1 w-[60%]`}><span className="font-bold">Delivery :</span> By Road</td>
            <td className={`${cellBorder} p-1 text-right align-top`} rowSpan={3}>
              <div className="font-bold">For <span className="text-red-600 underline">{c.name ?? "ABJAD ENGINEERING WORKS"}</span></div>
              <div className="my-8">&nbsp;</div>
              <div className="font-semibold">Authorised Signatory</div>
            </td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1`}><span className="font-bold">Payment :</span> 100% against Performa Invoice</td>
          </tr>
          <tr>
            <td className={`${cellBorder} p-1`}>
              <span className="font-bold">Contact Person</span> &nbsp; {c.contact_person ?? "—"} &nbsp; &nbsp;
              <span className="font-bold">Mob. No.</span> &nbsp; {c.mobile ?? ""}{c.alt_mobile ? ` / ${c.alt_mobile}` : ""}
            </td>
          </tr>
        </tbody>
      </table>

      {/* DECLARATION */}
      <div className="mt-2 text-[10px]">
        <div className="font-bold">DECLARATION.</div>
        <div>{c.declaration ?? "WE DECLARE THAT THIS INVOICE SHOWS THE ACTUAL PRICE OF THE GOODS DESCRIBED THAT ALL PARTICULARS ARE TRUE AND CORRECT"}</div>
      </div>

      <div className="mt-4 text-[10px] italic text-gray-600">1 | P a g e</div>
    </div>
  );
}