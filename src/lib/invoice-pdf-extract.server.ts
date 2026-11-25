const PROMPT = `You extract invoice data from an Indian GST invoice or purchase-related document.
Return ONLY a JSON object (no markdown fences) with exactly this shape:
{
  "customer_name": string,
  "customer_address": string,
  "company_name": string,
  "contact_person": string,
  "email": string,
  "gst_number": string,
  "footer_contact_person": string,
  "invoice_number": string,
  "invoice_date": "YYYY-MM-DD",
  "po_number": string,
  "po_date": "YYYY-MM-DD",
  "reference_challan_number": string,
  "reference_challan_dates": ["YYYY-MM-DD"],
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
- Extract the reference delivery challan number into reference_challan_number.
- Extract ALL dates associated with the reference delivery challan into reference_challan_dates.
- Look for labels such as "Reference Challan No.", "Ref. Challan No.", "Challan No.", "DC No.", "Delivery Challan No.", and their corresponding date labels.
- If multiple reference challan dates are printed, include EVERY date in reference_challan_dates in the order they appear in the document.
- Return reference_challan_dates as an array of YYYY-MM-DD strings.
- If no reference challan dates are present, return an empty array [].
- Do not confuse reference challan details with the seller-issued invoice number, purchase order number/date, actual delivery challan number/date, or work order number.
- If multiple reference challan numbers are printed, preserve them as printed, including commas or separators.
- Never substitute an invoice, PO, or work order date for a reference challan date.
- Do not confuse the PO number/date with the invoice number/date, challan number/date, or work order number.
- If a purchase order number or date is not present, return an empty string. Never substitute another document's number or date.
- All dates must be returned in YYYY-MM-DD format.
- tax_pct per item = SGST% + CGST%, or IGST% when IGST is charged (e.g. 9+9 -> 18).
- Include EVERY line item row, in printed order.
- Use "" for unknown text and 0 for unknown numbers. Never invent data.
- notes: only genuine remarks printed on the document; otherwise return an empty string.
- Extract the seller-issued invoice number into invoice_number.
- Do not confuse the invoice number with the PO number, challan number, or work order number.
- Preserve the invoice number exactly as printed, including prefixes, slashes, hyphens, and letters.
- If the invoice number is not present, return an empty string.
- Extract customer_address from the Address field/row belonging to the buyer.
- The customer address is printed beside or immediately below the Address label in the customer details section.
- Do NOT extract the seller's registered address, office address, or company-header address.
- Do NOT use the seller's address as the customer address.
- Preserve the complete customer address, including plot/flat number, building, street, area, city, state, and PIN code when printed.
- Preserve meaningful address separators and line breaks where possible.
- If the buyer's address is not present, return an empty string.`;

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
  reference_challan_number: string;
  reference_challan_dates: string[];
  customer_name: string;
  customer_address: string;
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

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const GROQ_RESPONSES_ENDPOINT = "https://api.groq.com/openai/v1/responses";
const OPENROUTER_RESPONSES_ENDPOINT = "https://openrouter.ai/api/v1/responses";
const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const RETRY_DELAY_MS = 700;
const NO_RETRY_STATUSES = new Set([400, 401, 402, 403, 429]);
const PERMANENT_STATUSES = new Set([400, 401, 402, 403]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NON_NUMERIC = /[^0-9.-]/g;
const JSON_OBJECT = /\{[\s\S]*\}/;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const num = (v: unknown) => {
  const n = Number(typeof v === "string" ? v.replace(NON_NUMERIC, "") : v);
  return Number.isFinite(n) ? n : 0;
};

const date = (v: unknown) => {
  const s = str(v); // trim once instead of twice
  return ISO_DATE.test(s) ? s : "";
};

const dates = (v: unknown): string[] => {
  const values = Array.isArray(v) ? v : v ? [v] : [];
  const out = new Set<string>();
  for (const value of values) {
    const d = date(value);
    if (d) out.add(d);
  }
  return [...out];
};

function normalize(raw: any): ExtractedInvoice {
  const rawItems: any[] = Array.isArray(raw?.items) ? raw.items : [];
  const customerName = str(raw?.customer_name);

  // Single pass: skip rows without a description before doing any other work
  // (previously every row was fully normalised, then filtered).
  const items: ExtractedItem[] = [];
  for (const it of rawItems) {
    const description = str(it?.description);
    if (!description) continue;
    items.push({
      hsn_code: str(it?.hsn_code),
      description,
      quantity: num(it?.quantity) || 1,
      uom: str(it?.uom) || "NOS",
      unit_rate: num(it?.unit_rate),
      discount_pct: num(it?.discount_pct),
      tax_pct: num(it?.tax_pct),
    });
  }

  return {
    reference_challan_number: str(raw?.reference_challan_number),
    reference_challan_dates: dates(raw?.reference_challan_dates ?? raw?.reference_challan_date),
    customer_name: customerName,
    customer_address: str(raw?.customer_address),
    company_name: customerName || str(raw?.company_name),
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
    items,
  };
}

function parseContent(content: string): ExtractedInvoice {
  try {
    const direct = JSON.parse(content);
    if (direct && typeof direct === "object" && !Array.isArray(direct)) {
      return normalize(direct);
    }
  } catch {
  }

  const match = content.match(JSON_OBJECT);
  if (!match) {
    throw new Error("The AI could not find invoice data in that document.");
  }
  return normalize(JSON.parse(match[0]));
}

class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

function apiError(status: number, body: string): ProviderError {
  let message = body;

  try {
    const parsed = JSON.parse(body);
    message = parsed?.error?.message ?? parsed?.message ?? body;
  } catch {
    // Keep the raw response body when it is not JSON.
  }

  if (status === 429) {
    message = "The AI provider is rate limited or temporarily overloaded.";
  } else if (status === 402) {
    message = "AI usage credits are exhausted for this provider.";
  } else if (status === 401 || status === 403) {
    message = "The AI provider rejected the API key or access permissions.";
  } else {
    message = `Could not read the document: ${message?.slice(0, 300) || status}`;
  }

  return new ProviderError(message, status);
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const isPermanentProviderError = (error: unknown): boolean =>
  error instanceof ProviderError && PERMANENT_STATUSES.has(error.status);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withTransientRetry<T>(operation: () => Promise<T>, provider: string, model: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Do not retry quota, authentication, permission, or invalid-request errors.
    if (error instanceof ProviderError && NO_RETRY_STATUSES.has(error.status)) {
      throw error;
    }
    console.warn(`[Invoice AI] ${provider}/${model} failed; retrying once:`, errorMessage(error));
    await sleep(RETRY_DELAY_MS);
    return operation();
  }
}

function getModelList(configuredValue: string | undefined, defaults: string[]): string[] {
  const configured = configuredValue
    ?.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return [...new Set(configured?.length ? configured : defaults)];
}

const stripDataUrl = (fileData: string) => fileData.slice(fileData.indexOf(",") + 1);

async function extractWordText(fileData: string, extension: "doc" | "docx"): Promise<string> {
  const buffer = Buffer.from(stripDataUrl(fileData), "base64");

  if (extension === "docx") {
    const mammoth = await import("mammoth");

    // HTML conversion retains table structure better than plain-text extraction.
    const result = await mammoth.convertToHtml({ buffer });

    if (!result.value.trim()) {
      throw new Error("No readable text was found in this Word document.");
    }
    return result.value;
  }

  const { default: WordExtractor } = await import("word-extractor");
  const document = await new WordExtractor().extract(buffer);

  const text = [document.getHeaders({ includeFooters: true }), document.getBody(), document.getFooters()]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("No readable text was found in this Word document.");
  }
  return text;
}
function buildGeminiBody(fileData: string, wordText?: string): string {
  const parts: any[] = [{ text: PROMPT }];

  if (wordText) {
    parts.push({
      text: `Extract invoice information from the following Word document content:\n\n${wordText}`,
    });
  } else {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: stripDataUrl(fileData),
      },
    });
  }

  return JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  });
}

async function extractWithGemini(body: string, apiKey: string, model: string): Promise<ExtractedInvoice> {
  const res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body,
  });

  if (!res.ok) {
    throw apiError(res.status, await res.text());
  }

  const json: any = await res.json();

  let content = "";
  for (const p of json?.candidates?.[0]?.content?.parts ?? []) {
    if (typeof p?.text === "string") content += p.text;
  }

  return parseContent(content);
}


function getResponsesOutputText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const chunks: string[] = [];

  for (const item of response?.output ?? []) {
    if (item?.type !== "message" || !Array.isArray(item?.content)) continue;

    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n");
}

async function extractWithGroq(
  wordText: string,
  apiKey: string,
  model: string,
): Promise<ExtractedInvoice> {
  const response = await fetch(GROQ_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${PROMPT}\n\nExtract invoice information from the following Word document content. Preserve table row order and associations between challan numbers and dates:\n\n${wordText}`,
            },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw apiError(response.status, await response.text());
  }

  const json: any = await response.json();
  const output = getResponsesOutputText(json);

  if (!output.trim()) {
    throw new Error("Groq returned an empty extraction response.");
  }

  return parseContent(output);
}

async function extractWithOpenRouter(
  fileData: string,
  fileName: string,
  wordText: string | undefined,
  apiKey: string,
  model: string,
): Promise<ExtractedInvoice> {
  const content: Array<Record<string, unknown>> = [
    { type: "input_text", text: PROMPT },
  ];

  if (wordText) {
    content.push({
      type: "input_text",
      text: `Extract invoice information from the following Word document content. Preserve table row order and associations between challan numbers and dates:\n\n${wordText}`,
    });
  } else {
    const pdfData = fileData.startsWith("data:")
      ? fileData
      : `data:application/pdf;base64,${stripDataUrl(fileData)}`;

    content.push({
      type: "input_file",
      filename: fileName,
      file_data: pdfData,
    });
  }

  const response = await fetch(OPENROUTER_RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "ABJAD ERP Invoice Extraction",
    },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      temperature: 0,
      ...(wordText
        ? {}
        : {
            plugins: [
              {
                id: "file-parser",
                pdf: { engine: "cloudflare-ai" },
              },
            ],
          }),
    }),
  });

  if (!response.ok) {
    throw apiError(response.status, await response.text());
  }

  const json: any = await response.json();
  const output = getResponsesOutputText(json);

  if (!output.trim()) {
    throw new Error("OpenRouter returned an empty extraction response.");
  }

  return parseContent(output);
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

  const failures: string[] = [];

  const geminiKey =
    process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"];

  const groqKey = process.env["GROQ_API_KEY"];
  const openRouterKey = process.env["OPENROUTER_API_KEY"];

  console.info("[Invoice AI] Extraction started", {
    fileName,
    hasGeminiKey: Boolean(geminiKey),
    hasGroqKey: Boolean(groqKey),
    hasOpenRouterKey: Boolean(openRouterKey),
  });

  // 1. Gemini — primary provider
  if (geminiKey) {
    const geminiModels = getModelList(
      process.env["GEMINI_MODELS"] || process.env["GEMINI_MODEL"],
      DEFAULT_GEMINI_MODELS,
    );

    const body = buildGeminiBody(fileData, wordText);

    for (const model of geminiModels) {
      try {
        console.info(`[Invoice AI] Trying Gemini model: ${model}`);

        const result = await withTransientRetry(
          () => extractWithGemini(body, geminiKey, model),
          "Gemini",
          model,
        );

        console.info(`[Invoice AI] Gemini succeeded: ${model}`);
        return result;
      } catch (error) {
        const message = errorMessage(error);
        failures.push(`Gemini ${model}: ${message}`);

        console.error(`[Invoice AI] Gemini failed: ${model}`, message);

        if (isPermanentProviderError(error)) break;
      }
    }
  } else {
    failures.push("Gemini API key is not configured.");
  }

  // 2. Groq — Word documents only
  // Groq's Responses API accepts text and images, not direct PDF files.
  if (wordText && groqKey) {
    const groqModel =
      process.env["GROQ_MODEL"] || DEFAULT_GROQ_MODEL;

    try {
      console.info(`[Invoice AI] Trying Groq fallback: ${groqModel}`);

      const result = await withTransientRetry(
        () => extractWithGroq(wordText!, groqKey, groqModel),
        "Groq",
        groqModel,
      );

      console.info(`[Invoice AI] Groq fallback succeeded: ${groqModel}`);
      return result;
    } catch (error) {
      const message = errorMessage(error);
      failures.push(`Groq ${groqModel}: ${message}`);

      console.error(`[Invoice AI] Groq fallback failed: ${message}`);
    }
  } else if (wordText && !groqKey) {
    failures.push("Groq: GROQ_API_KEY is not configured.");
  } else if (!wordText) {
    console.info(
      "[Invoice AI] Skipping Groq for PDF; using OpenRouter for PDF fallback.",
    );
  }

  // 3. OpenRouter — final fallback for PDFs and Word documents
  if (openRouterKey) {
    const openRouterModel =
      process.env["OPENROUTER_MODEL"] || DEFAULT_OPENROUTER_MODEL;

    try {
      console.info(
        `[Invoice AI] Trying OpenRouter fallback: ${openRouterModel}`,
      );

      const result = await withTransientRetry(
        () =>
          extractWithOpenRouter(
            fileData,
            fileName,
            wordText,
            openRouterKey,
            openRouterModel,
          ),
        "OpenRouter",
        openRouterModel,
      );

      console.info(
        `[Invoice AI] OpenRouter fallback succeeded: ${openRouterModel}`,
      );

      return result;
    } catch (error) {
      const message = errorMessage(error);
      failures.push(`OpenRouter ${openRouterModel}: ${message}`);

      console.error(`[Invoice AI] OpenRouter fallback failed: ${message}`);
    }
  } else {
    failures.push("OpenRouter: OPENROUTER_API_KEY is not configured.");
  }

  throw new Error(
    `Invoice extraction failed. All available AI providers failed. ${failures.join(" | ")}`,
  );
}
