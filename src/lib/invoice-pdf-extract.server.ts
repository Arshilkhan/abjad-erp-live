
import WordExtractor from "word-extractor";

// Server-only helper for extracting invoice data from PDF and Word documents.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const PROMPT = `
You extract invoice data from an Indian GST invoice or purchase-related document.

Return ONLY a JSON object (no markdown fences) with exactly this shape:

{
  "customer_name": string,
  "company_name": string,
  "contact_person": string,
  "email": string,
  "gst_number": string,
  "footer_contact_person": string,
  "invoice_number": string,
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
    {
      "hsn_code": string,
      "description": string,
      "quantity": number,
      "uom": string,
      "unit_rate": number,
      "discount_pct": number,
      "tax_pct": number
    }
  ]
}

Rules:

- The customer is the party being BILLED (buyer / Customer Name block), never the issuing seller company.
- contact_person and email must belong to the buyer. Leave empty when only the seller's contact is printed.
- footer_contact_person comes from the Contact Person lines printed near the bottom of the document.
- Do NOT extract, return, or infer any mobile number or telephone number.
- Extract the PURCHASE ORDER number into po_number.
- Extract the PURCHASE ORDER date into po_date.
- Do not confuse the PO number/date with the invoice number/date, challan number/date, or work order number.
- If a purchase order number or date is not present, return an empty string. Never substitute another document's number or date.
- All dates must be returned in YYYY-MM-DD format.
- tax_pct per item = SGST% + CGST%, or IGST% when IGST is charged (e.g. 9+9 -> 18).
- Include EVERY line item row, in printed order.
- Use "" for unknown text and 0 for unknown numbers. Never invent data.
- notes: only genuine remarks printed on the document, otherwise 
- Extract the seller-issued invoice number into invoice_number.
- Do not confuse the invoice number with the PO number, challan number, or work order number.
- Preserve the invoice number exactly as printed, including prefixes, slashes, hyphens, and letters.
- If the invoice number is not present, return an empty string."".
`;

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
  email: string;
  gst_number: string;
  footer_contact_person: string;
  invoice_number: string;
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

const str = (v: unknown) =>
  typeof v === "string" ? v.trim() : "";

const num = (v: unknown) => {
  const n = Number(
    typeof v === "string" ? v.replace(/[^0-9.-]/g, "") : v,
  );
  return Number.isFinite(n) ? n : 0;
};

const date = (v: unknown) =>
  /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : "";

function normalize(raw: any): ExtractedInvoice {
  const items = Array.isArray(raw?.items) ? raw.items : [];

  return {
    customer_name: str(raw?.customer_name),
    company_name:
      str(raw?.customer_name) || str(raw?.company_name),
    contact_person: str(raw?.contact_person),
    email: str(raw?.email),
    gst_number: str(raw?.gst_number).toUpperCase(),
    footer_contact_person: str(raw?.footer_contact_person),
    invoice_number: str(raw?.invoice_number),
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
    const parsed = JSON.parse(body);
    message = parsed?.error?.message ?? parsed?.message ?? body;
  } catch {
    // Keep raw body.
  }

  if (status === 429) {
    return new Error("AI is rate limited right now — please retry in a moment.");
  }

  if (status === 402 || status === 403) {
    return new Error(
      message || "AI usage is currently blocked right now.",
    );
  }

  return new Error(
    `Could not read the document: ${message?.slice(0, 300) || status}`,
  );
}

function parseContent(content: string): ExtractedInvoice {
  const match = content.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error("The AI could not find invoice data in that document.");
  }

  return normalize(JSON.parse(match[0]));
}

async function extractWordText(
  fileData: string,
  extension: "doc" | "docx",
): Promise<string> {
  const base64 = fileData.slice(fileData.indexOf(",") + 1);
  const buffer = Buffer.from(base64, "base64");

  if (extension === "docx") {
    const mammoth = await import("mammoth");

    // HTML conversion retains table structure better than plain-text extraction.
    const result = await mammoth.convertToHtml({ buffer });

    if (!result.value.trim()) {
      throw new Error("No readable text was found in this Word document.");
    }

    return result.value;
  }

  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);

  const sections = [
    document.getHeaders({ includeFooters: true }),
    document.getBody(),
    document.getFooters(),
  ];

  const text = sections.filter(Boolean).join("\n\n").trim();

  if (!text) {
    throw new Error("No readable text was found in this Word document.");
  }

  return text;
}

async function extractWithGemini(
  fileData: string,
  apiKey: string,
  wordText?: string,
): Promise<ExtractedInvoice> {
  const model = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";

  const parts: any[] = [{ text: PROMPT }];

  if (wordText) {
    parts.push({
      text: `Extract invoice information from the following Word document content:\n\n${wordText}`,
    });
  } else {
    const base64 = fileData.slice(fileData.indexOf(",") + 1);

    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: base64,
      },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    },
  );

  if (!res.ok) {
    throw apiError(res.status, await res.text());
  }

  const json: any = await res.json();

  const content: string = (json?.candidates?.[0]?.content?.parts ?? [])
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .join("");

  return parseContent(content);
}

async function extractWithLovableGateway(
  fileData: string,
  apiKey: string,
  wordText?: string,
): Promise<ExtractedInvoice> {
  const content: any[] = [{ type: "text", text: PROMPT }];

  if (wordText) {
    content.push({
      type: "text",
      text: `Extract invoice information from the following Word document content:\n\n${wordText}`,
    });
  } else {
    content.push({
      type: "file",
      file: {
        filename: "invoice.pdf",
        file_data: fileData,
      },
    });
  }

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash",
      messages: [
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw apiError(res.status, await res.text());
  }

  const json: any = await res.json();

  return parseContent(json?.choices?.[0]?.message?.content ?? "");
}

export async function extractInvoiceFromFile(
  fileData: string,
  fileName: string,
): Promise<ExtractedInvoice> {
  const extension = fileName.split(".").pop()?.toLowerCase();

  let wordText: string | undefined;

  if (extension === "doc" || extension === "docx") {
    wordText = await extractWordText(fileData, extension);
  } else if (extension !== "pdf") {
    throw new Error("Please upload a PDF, DOC, or DOCX document.");
  }

  const geminiKey =
    process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];

  if (geminiKey) {
    return await extractWithGemini(fileData, geminiKey, wordText);
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];

  if (lovableKey) {
    return await extractWithLovableGateway(fileData, lovableKey, wordText);
  }

  throw new Error(
    "AI is not configured: add GEMINI_API_KEY to this deployment's environment variables.",
  );
}
