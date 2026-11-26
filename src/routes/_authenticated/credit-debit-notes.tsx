
import {
  createFileRoute,
  Outlet,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreditDebitNoteTable } from "@/components/documents/credit-debit-note-table";
import { FinancialYearSelector } from "@/components/reports/shared/FinancialYearSelector";
import { useFinancialYears } from "@/components/reports/shared/useFinancialYears";
import { CancelInvoiceDialog } from "@/components/cancel-invoice-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { CreditDebitNoteRow } from "@/components/documents/credit-debit-note-table";
import {
  filterInvoicesByFinancialYear,
  getFinancialYearEndDate,
} from "@/components/reports/shared/financial-year-utils";

export const Route = createFileRoute(
  "/_authenticated/credit-debit-notes",
)({
  head: () => ({
    meta: [{ title: "Credit / Debit Notes — ABJAD ERP" }],
  }),
  component: CreditDebitNotesLayout,
});

function CreditDebitNotesLayout() {
  const path = useRouterState({
    select: (r) => r.location.pathname,
  });

  if (path !== "/credit-debit-notes") return <Outlet />;

  return <CreditDebitNotesIndex />;
}

function CreditDebitNotesIndex() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccess, canPerform } = useAuth();

  const {
    financialYears,
    selectedFinancialYear,
    selectedFinancialYearId,
    setSelectedFinancialYearId,
    isLoading: isFinancialYearsLoading,
  } = useFinancialYears();

  const [q, setQ] = useState("");

  const canCreateCredit = canPerform("credit_note", "create");
  const canCreateDebit = canPerform("debit_note", "create");
  const canCancelCredit = canPerform("credit_note", "cancel");
  const canCancelDebit = canPerform("debit_note", "cancel");

  const {
    data: documents = [],
    isLoading: isDocumentsLoading,
    error,
  } = useQuery({
    queryKey: ["credit-debit-notes"],
    enabled: canAccess("credit-debit-notes"),
    queryFn: async () => {
      const { data, error, status, count } = await supabase
        .from("cd_notes")
        .select(
          "id, invoice_number, invoice_type, invoice_date, customer_name_snapshot, grand_total, status",
          { count: "exact" },
        )
        .order("invoice_date", { ascending: false });

      console.log("CD NOTES QUERY RESPONSE:", {
        data,
        error,
        status,
        count,
      });

      if (error) throw error;

      return data ?? [];
    },
  });

  const financialYearEnd = selectedFinancialYear
    ? getFinancialYearEndDate(selectedFinancialYear)
    : "";

  const financialYearDocuments = useMemo(() => {
    return filterInvoicesByFinancialYear(
      documents,
      selectedFinancialYear,
      financialYearEnd,
    );
  }, [documents, selectedFinancialYear, financialYearEnd]);

  console.log("CD Notes Debug:", {
    selectedFinancialYear,
    financialYearEnd,
    documentsFromDatabase: documents,
    documentsAfterFinancialYearFilter: financialYearDocuments,
  });

  const notes: CreditDebitNoteRow[] = useMemo(
    () =>
      financialYearDocuments.map((document: any) => ({
        id: document.id,
        note_number: document.invoice_number,
        type: document.invoice_type,
        note_date: document.invoice_date,
        customer_name_snapshot: document.customer_name_snapshot,
        grand_total: document.grand_total,
        status: document.status,
      })),
    [financialYearDocuments],
  );

  const filteredNotes = useMemo(() => {
    const search = q.trim().toLowerCase();

    if (!search) return notes;

    return notes.filter((note) =>
      [
        note.note_number,
        note.type === "credit_note" ? "credit note" : "debit note",
        note.customer_name_snapshot,
        note.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(search),
        ),
    );
  }, [notes, q]);

  const openNote = (note: CreditDebitNoteRow) => {
    navigate({
      to: "/invoices/$id",
      params: { id: note.id },
      search: { kind: note.type },
    });
  };

  const editNote = (note: CreditDebitNoteRow) => {
    navigate({
      to: "/invoices/$id/edit",
      params: { id: note.id },
      search: { kind: note.type },
    });
  };

  const createNote = () => {
    navigate({
      to: "/credit-debit-notes/new",
      search: {
        kind: "credit_note",
      },
    });
  };

  const isLoading =
    isFinancialYearsLoading || isDocumentsLoading;

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Could not load credit and debit notes: {error.message}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Credit / Debit Notes"
        description="Manage customer credit notes and debit notes."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search notes or customers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <FinancialYearSelector
          financialYears={financialYears}
          selectedFinancialYearId={selectedFinancialYearId}
          onChange={setSelectedFinancialYearId}
          disabled={isFinancialYearsLoading}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <CreditDebitNoteTable
            rows={filteredNotes}
            isLoading={isLoading}
            canCreate={canCreateCredit || canCreateDebit}
            onCreate={createNote}
            onOpen={openNote}
            onEdit={editNote}
            onCancel={(note) => {
              // Cancellation is available through the shared detail page.
              openNote(note);
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
