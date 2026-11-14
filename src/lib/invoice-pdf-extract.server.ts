// Server-only helper: sends an invoice PDF to the Lovable AI Gateway and
// returns structured invoice fields for the Import Invoice form.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const PROMPT = `You extract invoice data from a scanned/typed Indian GST invoice PDF.
Return ONLY a JSON object (no markdown fences) with exactly this shape:
{
  "customer_name": string,
  "company_name": string,
  "contact_person": string,
  "mobile": string,
  "email": string,
  "gst_number": string,
  "footer_contact_person": string,
  "footer_contact_mobiles": string[],
  "invoice_date": "YYYY-MM-DD",
  "po_number": string,
  "po_date": "YYYY-MM-DD",
  "challan_number": string,
  "challan_date": "YYYY-MM-DD",
  "work_order_number": string,
  "freight": number,
  "packing_charges": number,
  "other_charges": number,
  "discount_amount": number,
  "delivery_mode": string,
  "payment_terms": string,
  "notes": string,
  "items": [
    { "hsn_code": string, "description": string, "quantity": number,
      "uom": string, "unit_rate": number, "discount_pct": number, "tax_pct": number }
  ]
}
Rules:
- The customer is the party being BILLED (buyer / "Customer Name" block), never the issuing seller company.
- contact_person / mobile / email must belong to the buyer; leave empty when only the seller's contact is printed.
- footer_contact_person / footer_contact_mobiles come from the "Contact Person" lines printed near the bottom of the invoice (usually below Delivery/Payment terms), regardless of whether they belong to the buyer or the seller. Always fill them when those lines are printed.
- footer_contact_mobiles: one entry per phone number; numbers printed as "9324329320 / 8169691366" become two entries. Keep digits only per entry.
- tax_pct per item = SGST% + CGST%, or the IGST% when IGST is charged (e.g. 9+9 -> 18).
- Include EVERY line item row, in printed order.
- Use "" for unknown text and 0 for unknown numbers. Never invent data.
- notes: only genuine remarks printed on the invoice, otherwise "".`;

export type ExtractedItem = {
  hsn_code: string;
  description: string;
  quantity: number;
  uom: string;
  unit_rate: number;
  discount_pct: number;
  tax_pct: number;
};

export type ExtractedInvoice = {
  customer_name: string;
  company_name: string;
  contact_person: string;
  mobile: string;
  email: string;
  gst_number: string;
  footer_contact_person: string;
  footer_contact_mobiles: string[];
  invoice_date: string;
  po_number: string;
  po_date: string;
  challan_number: string;
  challan_date: string;
  work_order_number: string;
  freight: number;
  packing_charges: number;
  other_charges: number;
  discount_amount: number;
  delivery_mode: string;
  payment_terms: string;
  notes: string;
  items: ExtractedItem[];
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => {
  const n = Number(typeof v === "string" ? v.replace(/[^0-9.\-]/g, "") : v);
  return Number.isFinite(n) ? n : 0;
};
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "");

function normalize(raw: any): ExtractedInvoice {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  return {
    customer_name: str(raw?.customer_name),
    // The buyer's company name is kept identical to the customer name; users can edit it manually.
    company_name: str(raw?.customer_name) || str(raw?.company_name),
    contact_person: str(raw?.contact_person),
    mobile: str(raw?.mobile),
    email: str(raw?.email),
    gst_number: str(raw?.gst_number).toUpperCase(),
    footer_contact_person: str(raw?.footer_contact_person),
    footer_contact_mobiles: (Array.isArray(raw?.footer_contact_mobiles)
      ? raw.footer_contact_mobiles
      : String(raw?.footer_contact_mobiles ?? "").split(/[\/,;]+/)
    )
      .map((m: unknown) => str(m).replace(/[^0-9+]/g, ""))
      .filter((m: string) => m.length >= 6),
    invoice_date: date(raw?.invoice_date),
    po_number: str(raw?.po_number),
    po_date: date(raw?.po_date),
    challan_number: str(raw?.challan_number),
    challan_date: date(raw?.challan_date),
    work_order_number: str(raw?.work_order_number),
    freight: num(raw?.freight),
    packing_charges: num(raw?.packing_charges),
    other_charges: num(raw?.other_charges),
    discount_amount: num(raw?.discount_amount),
    delivery_mode: str(raw?.delivery_mode),
    payment_terms: str(raw?.payment_terms),
    notes: str(raw?.notes),
    items: items
      .map((it: any) => ({
        hsn_code: str(it?.hsn_code),
        description: str(it?.description),
        quantity: num(it?.quantity) || 1,
        uom: str(it?.uom) || "NOS",
        unit_rate: num(it?.unit_rate),
        discount_pct: num(it?.discount_pct),
        tax_pct: num(it?.tax_pct),
      }))
      .filter((it: ExtractedItem) => it.description),
  };
}

function apiError(status: number, body: string): Error {
  let message = body;
  try {
    message = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? body;
  } catch { /* keep raw body */ }
  if (status === 429) return new Error("AI is rate limited right now — please retry in a moment.");
  if (status === 402 || status === 403) return new Error(message || "AI usage is currently blocked right now.");
  return new Error(`Could not read the PDF: ${message?.slice(0, 300) || status}`);
}

function parseContent(content: string): ExtractedInvoice {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("The AI could not find invoice data in that PDF.");
  return normalize(JSON.parse(match[0]));
}

async function extractWithGemini(fileData: string, apiKey: string): Promise<ExtractedInvoice> {
  const base64 = fileData.includes(",") ? fileData.slice(fileData.indexOf(",") + 1) : fileData;
  const model = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: "application/pdf", data: base64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );

  if (!res.ok) throw apiError(res.status, await res.text());

  const json: any = await res.json();
  const content: string = (json?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("");
  return parseContent(content);
}

async function extractWithLovableGateway(fileData: string, apiKey: string): Promise<ExtractedInvoice> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: "google/gemini-3-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "file", file: { filename: "invoice.pdf", file_data: fileData } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw apiError(res.status, await res.text());

  const json: any = await res.json();
  return parseContent(json?.choices?.[0]?.message?.content ?? "");
}

export async function extractInvoiceFromPdf(fileData: string): Promise<ExtractedInvoice> {
  const geminiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];
  if (geminiKey) return await extractWithGemini(fileData, geminiKey);

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (lovableKey) return await extractWithLovableGateway(fileData, lovableKey);

  throw new Error("AI is not configured: add GEMINI_API_KEY to this deployment's environment variables.");
}

