import { salesDocumentConfig, type SalesDocumentKind } from "@/lib/sales-documents";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { extractInvoicePdf } from "@/lib/invoice-pdf.functions";
import { sendInvoiceEmail } from "@/lib/invoice-email.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { formatINR, amountInWords } from "@/lib/format";
import { logInvoiceEvent } from "@/lib/invoice-history";
import { useInvoiceConfig } from "@/lib/invoice-config";
import { computeItem, emptyItem, type LineItem } from "@/components/forms/shared/types";
import { Row, ChargeRow } from "@/components/forms/shared/totals-section";
import { ProductLineItems } from "@/components/forms/shared/product-line-items";
import { DocumentDetails } from "@/components/forms/shared/document-details";
import { AdditionalDetails } from "@/components/forms/shared/additional-details";
import { DocumentFormCore } from "@/components/forms/shared/document-form-core";
import { getDocumentFormConfig } from "./shared/document-config";
import { buildDocumentPayload } from "./shared/document-payload";
import { saveDocument } from "./shared/save-document";
import { resolveCustomer, resolveProducts } from "./shared/resolve-document-data";
import { importInvoicePdf } from "./shared/pdf-import";

const CUSTOMER_COLUMNS =
  "id, customer_name, company_name, gst_number, billing_address, state, state_code, contact_person, mobile, email";
const PRODUCT_COLUMNS = "id, product_name, product_code, hsn_code, unit, gst_percentage, selling_price";
const REFERENCE_STALE_MS = 5 * 60 * 1000;

const DOCUMENT_NUMBER_LABELS: Record<string, string> = {
  tax_invoice: "Invoice Number",
  proforma: "Proforma Invoice Number",
};
const getDocumentNumberLabel = (type: string) => DOCUMENT_NUMBER_LABELS[type] ?? "Quotation Number";

const todayISO = () => new Date().toISOString().slice(0, 10);

type InvoiceConfigFn = ReturnType<typeof useInvoiceConfig>["cfg"];

interface TotalsCardProps {
  hidden: boolean;
  showTaxes: boolean;
  isIGST: boolean;
  isTaxInvoice: boolean;
  cfg: InvoiceConfigFn;
  totals: { net: number; tax: number; subtotal: number; grand: number; round_off: number };
  freight: number;
  packing: number;
  otherCharges: number;
  transportCharges: number;
  deliveryCharges: number;
  setFreight: (v: number) => void;
  setPacking: (v: number) => void;
  setOtherCharges: (v: number) => void;
  setTransportCharges: (v: number) => void;
  setDeliveryCharges: (v: number) => void;
}

const TotalsCard = memo(function TotalsCard({
  hidden,
  showTaxes,
  isIGST,
  isTaxInvoice,
  cfg,
  totals,
  freight,
  packing,
  otherCharges,
  transportCharges,
  deliveryCharges,
  setFreight,
  setPacking,
  setOtherCharges,
  setTransportCharges,
  setDeliveryCharges,
}: TotalsCardProps) {
  const halfTax = totals.tax / 2;
  return (
    <Card className={hidden ? "hidden" : undefined}>
      <CardHeader>
        <CardTitle className="text-base">Totals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Net Value" value={formatINR(totals.net)} />

        <ChargeRow config={cfg("freight_charges")} fallbackLabel="Freight" value={freight} onChange={setFreight} />

        {isTaxInvoice && (
          <>
            <ChargeRow
              config={cfg("transportation_charges")}
              fallbackLabel="Transportation Charges"
              value={transportCharges}
              onChange={setTransportCharges}
            />
            <ChargeRow
              config={cfg("delivery_charges")}
              fallbackLabel="Delivery Charges"
              value={deliveryCharges}
              onChange={setDeliveryCharges}
            />
          </>
        )}

        <ChargeRow
          config={cfg("packing_charges")}
          fallbackLabel="Packing & Forwarding"
          value={packing}
          onChange={setPacking}
        />
        <ChargeRow
          config={cfg("other_charges")}
          fallbackLabel="Other Charges"
          value={otherCharges}
          onChange={setOtherCharges}
        />

        <div className="border-t pt-2">
          <Row label="Subtotal" value={formatINR(totals.subtotal)} />
          {showTaxes &&
            (isIGST ? (
              <Row label="IGST" value={formatINR(totals.tax)} />
            ) : (
              <>
                <Row label="CGST" value={formatINR(halfTax)} />
                <Row label="SGST" value={formatINR(halfTax)} />
              </>
            ))}
          <Row label="Round Off" value={formatINR(totals.round_off)} />
        </div>

        <div className="flex items-center justify-between border-t pt-2 text-base font-bold">
          <span>Grand Total</span>
          <span className="tabular-nums">{formatINR(totals.grand)}</span>
        </div>

        <p className="pt-1 text-xs italic text-muted-foreground">{amountInWords(totals.grand)}</p>
      </CardContent>
    </Card>
  );
});

export interface DocumentFormProps {
  editId?: string;
  importMode?: boolean;
  documentType?: SalesDocumentKind;
}

export function DocumentForm({ editId, importMode, documentType = "tax_invoice" }: DocumentFormProps) {
  const formConfig = getDocumentFormConfig(documentType);
  const docCfg = salesDocumentConfig(documentType);
  const docTable = docCfg.table as "invoices";
  const docItemsTable = docCfg.itemsTable as "invoice_items";
  const { isTaxInvoice, isChallan } = formConfig;
  const isEdit = !!editId;

  const nav = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, canPerform } = useAuth();
  const { cfg } = useInvoiceConfig();

  const [items, setItems] = useState<LineItem[]>(() => [emptyItem(1)]);
  const [productTexts, setProductTexts] = useState<string[]>([""]);
  const [invoiceDate, setInvoiceDate] = useState(todayISO);
  const [invoiceType, setInvoiceType] = useState<string>(documentType);

  const [customerId, setCustomerId] = useState("");
  const [customerText, setCustomerText] = useState("");
  const [custCompany, setCustCompany] = useState("");
  const [custAddress, setCustAddress] = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custGst, setCustGst] = useState("");

  const [referenceChallanNumber, setReferenceChallanNumber] = useState("");
  const [referenceChallanDates, setReferenceChallanDates] = useState<string[]>([]);
  const [referenceChallanDateInput, setReferenceChallanDateInput] = useState("");
  const [challanNumber, setChallanNumber] = useState("");
  const [challanDates, setChallanDates] = useState<string[]>([]);
  const [challanDateInput, setChallanDateInput] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [workOrder, setWorkOrder] = useState("");

  const [freight, setFreight] = useState(0);
  const [packing, setPacking] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [transportCharges, setTransportCharges] = useState(0);
  const [deliveryCharges, setDeliveryCharges] = useState(0);

  const [deliveryMode, setDeliveryMode] = useState("By Road");
  const [paymentTerms, setPaymentTerms] = useState("30 Days");
  const [notes, setNotes] = useState("");
  const [movementReason, setMovementReason] = useState("Delivery / Supply");
  const [transporterName, setTransporterName] = useState("");
  const [placeOfDispatch, setPlaceOfDispatch] = useState("");
  const [placeOfDelivery, setPlaceOfDelivery] = useState("");

  const [hydrated, setHydrated] = useState(false);

  // PDF-import state (declared up-front so the save mutation can read it).
  const runExtract = useServerFn(extractInvoicePdf);
  const sendEmail = useServerFn(sendInvoiceEmail);
  const [extracting, setExtracting] = useState(false);
  const [pdfName, setPdfName] = useState("");
  const [pdfImported, setPdfImported] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list"],
    staleTime: REFERENCE_STALE_MS,
    queryFn: async () => (await supabase.from("customers").select(CUSTOMER_COLUMNS)).data ?? [],
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products-list"],
    staleTime: REFERENCE_STALE_MS,
    queryFn: async () => (await supabase.from("products").select(PRODUCT_COLUMNS)).data ?? [],
  });
  const { data: settings } = useQuery({
    queryKey: ["invoice-settings"],
    staleTime: REFERENCE_STALE_MS,
    queryFn: async () => (await supabase.from("invoice_settings").select("*").limit(1).maybeSingle()).data,
  });
  const { data: company } = useQuery({
    queryKey: ["company"],
    staleTime: REFERENCE_STALE_MS,
    queryFn: async () => (await supabase.from("company_profile").select("state_code").limit(1).maybeSingle()).data,
  });

  // Load existing document for edit (items fetched in parallel).
  const { data: existing } = useQuery({
    queryKey: ["invoice-edit", documentType, editId],
    enabled: isEdit,
    refetchOnWindowFocus: false, // hydration happens once; refetching would be wasted work
    queryFn: async () => {
      const [inv, its] = await Promise.all([
        supabase.from(docTable).select("*").eq("id", editId!).single(),
        supabase.from(docItemsTable).select("*").eq("invoice_id", editId!).order("sr_no"),
      ]);
      if (inv.error) throw inv.error;
      return { invoice: inv.data, items: its.data ?? [] };
    },
  });
  const customerById = useMemo(() => new Map(customers.map((c: any) => [c.id, c])), [customers]);
  const productById = useMemo(() => new Map(products.map((p: any) => [p.id, p])), [products]);

  const customer: any = customerById.get(customerId);
  const isIGST = !!(customer?.state_code && company?.state_code && customer.state_code !== company.state_code);

  useEffect(() => {
    if (!existing || hydrated) return;
    const inv = existing.invoice as Record<string, any>; // single cast instead of many `as any`

    setCustomerId(inv.customer_id ?? "");
    setCustomerText(inv.customer_name_snapshot ?? "");
    setInvoiceType(documentType);
    setInvoiceDate(inv.invoice_date);
    if (!isChallan) setDocumentNumber(inv.invoice_number ?? "");

    if (isTaxInvoice) {
      setPoNumber(inv.po_number ?? "");
      setPoDate(inv.po_date ?? "");
      setReferenceChallanNumber(inv.reference_challan_number ?? "");
      setReferenceChallanDates(
        (inv.reference_challan_dates as string[] | null) ??
        (inv.reference_challan_date ? [inv.reference_challan_date] : [])
      );
    }
    if (isChallan) {
      setChallanNumber(inv.challan_number ?? "");
      setChallanDates((inv.challan_dates as string[] | null) ?? (inv.challan_date ? [inv.challan_date] : []));
    }

    setWorkOrder(inv.work_order_number ?? "");
    if (formConfig.showPaymentTerms) {
      setFreight(Number(inv.freight ?? 0));
      setPacking(Number(inv.packing_charges ?? 0));
      setOtherCharges(Number(inv.other_charges ?? 0));
      if (isTaxInvoice) {
        setTransportCharges(Number(inv.transportation_charges ?? 0));
        setDeliveryCharges(Number(inv.delivery_charges ?? 0));
      }
    }
    setDeliveryMode(inv.delivery_mode ?? "");
    setPaymentTerms(inv.payment_terms ?? "");
    setNotes(inv.notes ?? "");
    setMovementReason(inv.movement_reason ?? "Delivery / Supply");
    setTransporterName(inv.transporter_name ?? "");
    setPlaceOfDispatch(inv.place_of_dispatch ?? "");
    setPlaceOfDelivery(inv.place_of_delivery ?? "");

    if (existing.items.length) {
      // Build both arrays in a single pass.
      const nextItems: LineItem[] = [];
      const nextTexts: string[] = [];
      existing.items.forEach((it: any, i: number) => {
        nextItems.push({
          sr_no: it.sr_no ?? i + 1,
          product_id: it.product_id,
          hsn_code: it.hsn_code ?? "",
          description: it.description ?? "",
          quantity: Number(it.quantity ?? 1),
          uom: it.uom ?? "NOS",
          unit_rate: isChallan ? 0 : Number(it.unit_rate ?? 0),
          discount_mode: "pct" as const,
          discount_value: isChallan ? 0 : Number(it.discount_pct ?? 0),
          tax_pct: isChallan ? 0 : Number(it.tax_pct ?? 18),
          serial_batch_number: it.serial_batch_number ?? "",
        });
        nextTexts.push(it.description ?? "");
      });
      setItems(nextItems);
      setProductTexts(nextTexts);
    } else {
      setItems([emptyItem(1)]);
      setProductTexts([""]);
    }
    setHydrated(true);
  }, [existing, hydrated]);

  useEffect(() => {
    if (!customer) return;
    setCustomerText(customer.customer_name || customer.company_name || "");
    setCustCompany(customer.company_name ?? "");
    setCustAddress(customer.billing_address ?? "");
    setCustMobile(customer.mobile ?? "");
    setCustEmail(customer.email ?? "");
    setCustGst(customer.gst_number ?? "");
  }, [customerId, customer]);
  const totals = useMemo(() => {
    let net = 0;
    let tax = 0;
    let disc = 0;
    for (const it of items) {
      const c = computeItem(it);
      net += c.net;
      tax += c.tax_amount;
      disc += c.discount_amount;
    }
    const subtotal =
      net +
      Number(freight || 0) +
      Number(packing || 0) +
      Number(otherCharges || 0) +
      Number(transportCharges || 0) +
      Number(deliveryCharges || 0);
    const preRound = subtotal + tax;
    const grand = Math.round(preRound);
    return { net, tax, disc, subtotal, grand, round_off: grand - preRound };
  }, [items, freight, packing, otherCharges, transportCharges, deliveryCharges]);
  const addChallanDate = useCallback(() => {
    if (!challanDateInput) return;
    setChallanDates((prev) => (prev.includes(challanDateInput) ? prev : [...prev, challanDateInput].sort()));
    setChallanDateInput("");
  }, [challanDateInput]);

  const addReferenceChallanDate = useCallback(() => {
    if (!referenceChallanDateInput) return;

    setReferenceChallanDates((prev) =>
      prev.includes(referenceChallanDateInput)
        ? prev
        : [...prev, referenceChallanDateInput].sort()
    );

    setReferenceChallanDateInput("");
  }, [referenceChallanDateInput]);

  const setItem = useCallback((idx: number, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }, []);

  const addItem = useCallback(() => {
    setItems((p) => [...p, emptyItem(p.length + 1)]);
    setProductTexts((p) => [...p, ""]);
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((p) => p.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sr_no: i + 1 })));
    setProductTexts((p) => p.filter((_, i) => i !== idx));
  }, []);

  const applyProduct = useCallback(
    (idx: number, pid: string) => {
      const p: any = productById.get(pid);
      if (!p) return;
      setItem(idx, {
        product_id: p.id,
        hsn_code: p.hsn_code ?? "",
        description: p.product_name,
        unit_rate: Number(p.selling_price ?? 0),
        uom: p.unit ?? "NOS",
        tax_pct: Number(p.gst_percentage ?? 18),
      });
    },
    [productById, setItem],
  );

  const setProductText = useCallback((idx: number, value: string) => {
    setProductTexts((prev) => prev.map((text, i) => (i === idx ? value : text)));
  }, []);

  const save = useMutation({
    mutationFn: async (status: "draft" | "sent") => {
      if (!isEdit && !canPerform(documentType, "create")) {
        throw new Error(`You do not have permission to create ${docCfg.label}.`);
      }

      const nameTyped = customerText.trim();
      if (!custCompany.trim()) throw new Error("Please enter a company name");
      if (settings?.mandatory_gst_number && !custGst.trim()) throw new Error("Customer GST Number is mandatory");
      if (isChallan && settings?.mandatory_challan_number && !challanNumber)
        throw new Error("Challan Number is mandatory");
      if (!isChallan && !documentNumber.trim()) throw new Error(`${docCfg.label} Number is mandatory`);

      if (formConfig.showPaymentTerms) {
        const requireCharge = (key: string, val: number) => {
          const c = cfg(key);
          if (c.visible && c.mandatory && !Number(val)) throw new Error(`${c.label || key} is mandatory`);
        };
        requireCharge("freight_charges", freight);
        requireCharge("packing_charges", packing);
        requireCharge("other_charges", otherCharges);
        if (isTaxInvoice) {
          requireCharge("transportation_charges", transportCharges);
          requireCharge("delivery_charges", deliveryCharges);
        }
      }
      if (items.length === 0) throw new Error("Add at least one item");

      const [cust, resolvedItems] = await Promise.all([
        resolveCustomer({
          supabase,
          customer,
          customers,
          customerText,
          custCompany,
          custAddress,
          custMobile,
          custEmail,
          custGst,
          createdBy: user?.id,
        }),
        resolveProducts({ supabase, items, productTexts, products }),
      ]);

      const { data: financialYear, error: financialYearError } = await supabase
        .from("f_year")
        .select("id")
        .lte("start_date", invoiceDate)
        .gte("end_date", invoiceDate)
        .maybeSingle();

      if (financialYearError) {
        throw financialYearError;
      }

      if (!financialYear) {
        throw new Error(
          `No financial year is configured for invoice date ${invoiceDate}.`,
        );
      }

      const payload = buildDocumentPayload({
        financialYearId: financialYear.id,
        invoiceType,
        invoiceDate,
        customerId: cust.id,
        customerName: cust.company_name || cust.customer_name,
        customerGst: cust.gst_number,
        customerAddress: custAddress.trim() || cust.billing_address,
        workOrder,
        deliveryMode,
        contactPerson: nameTyped,
        contactMobile: custMobile,
        notes,
        status,
        referenceChallanNumber,
        referenceChallanDates,
        isChallan,
        isTaxInvoice,
        isIGST,
        challanNumber,
        documentNumber,
        poNumber,
        poDate,
        challanDates,
        movementReason,
        transporterName,
        placeOfDispatch,
        placeOfDelivery,
        totals,
        freight,
        packing,
        otherCharges,
        transportCharges,
        deliveryCharges,
        paymentTerms,
      });

      return saveDocument({
        supabase,
        documentType,
        docTable,
        docItemsTable,
        payload,
        items: resolvedItems,
        isChallan,
        isEdit,
        editId,
        docPrefix: docCfg.prefix,
        customerName: custCompany || cust.company_name || cust.customer_name || customerText || "customer",
        createdBy: user?.id,
        isTaxInvoice,
        importMode,
        pdfImported,
      });
    },

    onSuccess: async (inv, status) => {
      qc.invalidateQueries({ queryKey: ["customers-list"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });

      if (isTaxInvoice) {
        const [event, message] = isEdit
          ? (["edited", "Invoice edited"] as const)
          : importMode || pdfImported
            ? (["imported", `Imported invoice ${inv.invoice_number}`] as const)
            : (["created", `Created invoice ${inv.invoice_number}`] as const);
        await logInvoiceEvent(inv.id, event, message);
      }

      toast.success(`${docCfg.label} ${inv.invoice_number} ${isEdit ? "updated" : importMode ? "imported" : "created"}`);

      if (status === "sent") {
        try {
          const res: any = await sendEmail({ data: { invoiceId: inv.id, kind: documentType } });
          if (res?.sent) {
            toast.success(`Invoice emailed to ${res.email}`);
            if (isTaxInvoice) await logInvoiceEvent(inv.id, "sent", `Invoice emailed to ${res.email}`);
          } else if (res?.reason === "no_email") {
            toast.info("Saved. No customer email on file, so nothing was sent.");
          } else if (res?.reason === "recipient_suppressed") {
            toast.warning("Saved. The customer has unsubscribed from emails.");
          }
        } catch (err: any) {
          toast.error(`Invoice saved, but the email could not be sent: ${err?.message ?? "unknown error"}`);
        }
      }

      nav({ to: "/invoices/$id", params: { id: inv.id }, search: { kind: documentType } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveDraft = useCallback(() => save.mutate("draft"), [save.mutate]);
  const saveAndSend = useCallback(() => save.mutate("sent"), [save.mutate]);
  const goBack = useCallback(() => router.history.back(), [router]);
  const handlePdf = useCallback(
    (file: File) =>
      importInvoicePdf({
        setReferenceChallanNumber,
        setReferenceChallanDates,
        setPoNumber,
        setCustAddress,
        setPoDate,
        file,
        runExtract,
        customers,
        products,
        isTaxInvoice,
        setDocumentNumber,
        setPdfName,
        setPdfImported,
        setExtracting,
        setCustomerId,
        setCustomerText,
        setCustCompany,
        setCustMobile,
        setCustEmail,
        setCustGst,
        setInvoiceDate,
        setWorkOrder,
        setFreight,
        setPacking,
        setOtherCharges,
        setDeliveryMode,
        setPaymentTerms,
        setNotes,
        setItems,
        setProductTexts,
        toast,
      }),
    [runExtract, customers, products, isTaxInvoice],
  );
  const lowerLabel = docCfg.label.toLowerCase();
  const title = isEdit
    ? `Edit ${docCfg.label}${existing?.invoice?.invoice_number ? ` — ${existing.invoice.invoice_number}` : ""}`
    : importMode
      ? "Import Invoice"
      : `New ${docCfg.label}`;
  const description = importMode
    ? "Record an invoice that was created outside the software. It'll be tagged 'Imported' and behaves like a normal invoice."
    : isEdit
      ? `Update ${lowerLabel} details.`
      : isTaxInvoice
        ? "Create a GST tax invoice. Field visibility and mandatory rules follow your Settings."
        : `Create a ${lowerLabel}.`;

  return (
    <DocumentFormCore
      header={
        <PageHeader
          title={title}
          description={description}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <Button variant="outline" onClick={saveDraft} disabled={save.isPending}>
                Save Draft
              </Button>
              <Button onClick={saveAndSend} disabled={save.isPending}>
                {save.isPending ? "Saving…" : isEdit ? "Save Changes" : "Save & Send"}
              </Button>
            </div>
          }
        />
      }
      details={
        <DocumentDetails
          referenceChallanNumber={referenceChallanNumber}
          referenceChallanDates={referenceChallanDates}
          referenceChallanDateInput={referenceChallanDateInput}
          setReferenceChallanDateInput={setReferenceChallanDateInput}
          setReferenceChallanDates={setReferenceChallanDates}
          addReferenceChallanDate={addReferenceChallanDate}
          setReferenceChallanNumber={setReferenceChallanNumber}
          isChallan={isChallan}
          isEdit={isEdit}
          isTaxInvoice={isTaxInvoice}
          isIGST={isIGST}
          docLabel={docCfg.label}
          customers={customers}
          settings={settings}
          customerId={customerId}
          customerText={customerText}
          custCompany={custCompany}
          custAddress={custAddress}
          custMobile={custMobile}
          custEmail={custEmail}
          custGst={custGst}
          invoiceDate={invoiceDate}
          movementReason={movementReason}
          challanNumber={challanNumber}
          challanDates={challanDates}
          challanDateInput={challanDateInput}
          workOrder={workOrder}
          extracting={extracting}
          pdfName={pdfName}
          pdfImported={pdfImported}
          setCustomerId={setCustomerId}
          setCustomerText={setCustomerText}
          setCustCompany={setCustCompany}
          setCustAddress={setCustAddress}
          setCustMobile={setCustMobile}
          setCustEmail={setCustEmail}
          setCustGst={setCustGst}
          setInvoiceDate={setInvoiceDate}
          setMovementReason={setMovementReason}
          setChallanNumber={setChallanNumber}
          setChallanDateInput={setChallanDateInput}
          setWorkOrder={setWorkOrder}
          setChallanDates={setChallanDates}
          addChallanDate={addChallanDate}
          handlePdf={handlePdf}
          documentNumber={documentNumber}
          setDocumentNumber={setDocumentNumber}
          poNumber={poNumber}
          setPoNumber={setPoNumber}
          poDate={poDate}
          setPoDate={setPoDate}
          documentNumberLabel={getDocumentNumberLabel(documentType)}
        />
      }
      items={
        <ProductLineItems
          items={items}
          productTexts={productTexts}
          products={products}
          isChallan={isChallan}
          setItem={setItem}
          setProductText={setProductText}
          applyProduct={applyProduct}
          removeItem={removeItem}
          addItem={addItem}
        />
      }
      additionalDetails={
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AdditionalDetails
            showPaymentTerms={formConfig.showPaymentTerms}
            showTransportDetails={formConfig.showTransportDetails}
            isEdit={isEdit}
            showDelivery={settings?.show_delivery}
            deliveryMode={deliveryMode}
            paymentTerms={paymentTerms}
            transporterName={transporterName}
            placeOfDispatch={placeOfDispatch}
            placeOfDelivery={placeOfDelivery}
            notes={notes}
            setDeliveryMode={setDeliveryMode}
            setPaymentTerms={setPaymentTerms}
            setTransporterName={setTransporterName}
            setPlaceOfDispatch={setPlaceOfDispatch}
            setPlaceOfDelivery={setPlaceOfDelivery}
            setNotes={setNotes}
          />

          <TotalsCard
            hidden={!formConfig.showPricing}
            showTaxes={formConfig.showTaxes}
            isIGST={isIGST}
            isTaxInvoice={isTaxInvoice}
            cfg={cfg}
            totals={totals}
            freight={freight}
            packing={packing}
            otherCharges={otherCharges}
            transportCharges={transportCharges}
            deliveryCharges={deliveryCharges}
            setFreight={setFreight}
            setPacking={setPacking}
            setOtherCharges={setOtherCharges}
            setTransportCharges={setTransportCharges}
            setDeliveryCharges={setDeliveryCharges}
          />
        </div>
      }
    />
  );
}