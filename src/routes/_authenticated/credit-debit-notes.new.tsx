
import { createFileRoute } from "@tanstack/react-router";
import { CreditNoteForm } from "@/components/forms/credit-note-form";
import { DebitNoteForm } from "@/components/forms/debit-note-form";

type NoteKind = "credit_note" | "debit_note";

export const Route = createFileRoute(
  "/_authenticated/credit-debit-notes/new"
)({
  validateSearch: (search: Record<string, unknown>): { kind: NoteKind } => ({
    kind: search.kind === "debit_note" ? "debit_note" : "credit_note",
  }),
  component: NewCreditDebitNote,
});

function NewCreditDebitNote() {
  const { kind } = Route.useSearch();

  return kind === "credit_note" ? (
    <CreditNoteForm />
  ) : (
    <DebitNoteForm />
  );
}
