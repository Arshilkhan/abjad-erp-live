import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDocumentItemRows } from "./document-item-payload";
import type { LineItem } from "./types";
import type { SalesDocumentKind } from "@/lib/sales-documents";

interface SaveDocumentArgs {
  supabase: SupabaseClient;
  documentType: SalesDocumentKind;
  docTable: string;
  docItemsTable: string;
  payload: any;
  items: LineItem[];
  isChallan: boolean;
  isEdit: boolean;
  editId?: string;
  docPrefix: string;
  customerName: string;
  createdBy?: string;
  isTaxInvoice: boolean;
  importMode?: boolean;
  pdfImported?: boolean;
}

export async function saveDocument({
  supabase,
  documentType,
  docTable,
  docItemsTable,
  payload,
  items,
  isChallan,
  isEdit,
  editId,
  docPrefix,
  customerName,
  createdBy,
  isTaxInvoice,
  importMode,
  pdfImported,
}: SaveDocumentArgs) {
  let invId: string;
  let invNumber: string;

  // Check manual document numbers only for Tax Invoices, Proforma Invoices,
  // and Quotations. Challan numbering is deliberately left on its old path.
  if (!isChallan) {
    const manualNumber = String(payload.invoice_number ?? "").trim();

    if (!manualNumber) {
      throw new Error("Document number is mandatory.");
    }

    let duplicateQuery = supabase
      .from(docTable)
      .select("id")
      .eq("invoice_number", manualNumber);

    if (isEdit && editId) {
      duplicateQuery = duplicateQuery.neq("id", editId);
    }

    const { data: duplicate, error: duplicateError } =
      await duplicateQuery.maybeSingle();

    if (duplicateError) throw duplicateError;

    if (duplicate) {
      throw new Error(
        `The document number "${manualNumber}" is already in use.`,
      );
    }
  }

  if (isEdit) {
    const { data: inv, error } = await supabase
      .from(docTable)
      .update(payload)
      .eq("id", editId!)
      .select()
      .single();

    if (error?.code === "23505" && !isChallan) {
      throw new Error("This document number is already in use.");
    }
    if (error) throw error;

    invId = inv.id;
    invNumber = inv.invoice_number;

    const { error: dErr } = await supabase
      .from(docItemsTable)
      .delete()
      .eq("invoice_id", invId);

    if (dErr) throw dErr;
  } else {
    const { data: allowed, error: permissionError } =
      await (supabase as any).rpc(
        "can_perform_document_action",
        {
          _document_kind: documentType,
          _action: "create",
        },
      );

    if (permissionError) throw permissionError;

    if (!allowed) {
      throw new Error(
        "You do not have permission to create this document.",
      );
    }

    if (!isChallan) {
      // New manual-numbering path for Tax Invoice, Proforma, and Quotation.
      const insertPayload: any = {
        ...payload,
        invoice_number: String(payload.invoice_number).trim(),
        created_by: createdBy,
      };

      if (isTaxInvoice && (importMode || pdfImported)) {
        insertPayload.is_imported = true;
        insertPayload.import_source = "manual";
      }

      const { data: inv, error } = await supabase
        .from(docTable)
        .insert(insertPayload)
        .select()
        .single();

      if (error?.code === "23505") {
        throw new Error("This document number is already in use.");
      }
      if (error) throw error;

      invId = inv.id;
      invNumber = inv.invoice_number;
    } else {
      // Existing automatic Challan numbering logic — intentionally unchanged.
      const slug =
        customerName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "customer";

      const { data: existing } = await supabase
        .from(docTable)
        .select("invoice_number");

      const seqRe = docPrefix
        ? new RegExp(`^${docPrefix}(\\d+)-`, "i")
        : /^(\d+)-/;

      let seq = 0;

      for (const row of existing ?? []) {
        const match = seqRe.exec(row.invoice_number ?? "");
        if (match) {
          seq = Math.max(seq, Number(match[1]));
        }
      }

      let inserted: any = null;
      let lastErr: any = null;

      for (let attempt = 0; attempt < 25; attempt++) {
        seq += 1;

        const invoice_number = `${docPrefix}${seq}-${slug}`;

        const insertPayload: any = {
          ...payload,
          invoice_number,
          created_by: createdBy,
        };

        if (isTaxInvoice && (importMode || pdfImported)) {
          insertPayload.is_imported = true;
          insertPayload.import_source = "manual";
        }

        const { data: inv, error } = await supabase
          .from(docTable)
          .insert(insertPayload)
          .select()
          .single();

        if (!error) {
          inserted = inv;
          lastErr = null;
          break;
        }

        lastErr = error;

        if (error.code !== "23505") break;
      }

      if (!inserted) {
        throw lastErr ??
          new Error("Could not generate a unique invoice number");
      }

      invId = inserted.id;
      invNumber = inserted.invoice_number;
    }
  }

  const rows = buildDocumentItemRows(
    items,
    invId,
    isChallan,
  );

  const { error: iErr } = await supabase
    .from(docItemsTable)
    .insert(rows);

  if (iErr) throw iErr;

  return {
    id: invId,
    invoice_number: invNumber,
  };
}
