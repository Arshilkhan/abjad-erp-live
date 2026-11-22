
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_DATA_URL_CHARS = 21_500_000;

export const extractInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileData: string; fileName: string }) => {
    if (
      typeof input?.fileData !== "string" ||
      !input.fileData.startsWith("data:") ||
      !input.fileData.includes(";base64,")
    ) {
      throw new Error("Please upload a valid document.");
    }

    if (typeof input?.fileName !== "string") {
      throw new Error("The document filename is missing.");
    }

    const extension = input.fileName.split(".").pop()?.toLowerCase();

    if (!["pdf", "doc", "docx"].includes(extension ?? "")) {
      throw new Error("Please upload a PDF, DOC, or DOCX document.");
    }

    if (input.fileData.length > MAX_DATA_URL_CHARS) {
      throw new Error("The document is too large. Please upload a file under 15 MB.");
    }

    return input;
  })
  .handler(async ({ data, context }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");

    await enforceRateLimit("pdf-extract", context.userId, 20, 3600);

    const { extractInvoiceFromFile } = await import(
      "./invoice-pdf-extract.server"
    );

    return await extractInvoiceFromFile(data.fileData, data.fileName);
  });

export const extractInvoicePdfBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileData: string; fileName: string }) => {
    if (
      typeof input?.fileData !== "string" ||
      !input.fileData.startsWith("data:") ||
      !input.fileData.includes(";base64,")
    ) {
      throw new Error("Please upload a valid document.");
    }

    if (
      typeof input?.fileName !== "string" ||
      !input.fileName.trim()
    ) {
      throw new Error("The document filename is missing.");
    }

    const extension = input.fileName.split(".").pop()?.toLowerCase();

    if (!["pdf", "doc", "docx"].includes(extension ?? "")) {
      throw new Error(
        "Please upload a PDF, DOC, or DOCX document.",
      );
    }

    if (input.fileData.length > MAX_DATA_URL_CHARS) {
      throw new Error(
        "The document is too large. Please upload a file under 15 MB.",
      );
    }

    return input;
  })
  .handler(async ({ data, context }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");

    await enforceRateLimit(
      "pdf-extract-bulk",
      context.userId,
      200,
      3600,
    );

    const { extractInvoiceFromFile } = await import(
      "./invoice-pdf-extract.server"
    );

    return await extractInvoiceFromFile(
      data.fileData,
      data.fileName,
    );
  });
