import { DocumentForm, type DocumentFormProps } from "./document-form";

export type DebitNoteFormProps = Omit<
  DocumentFormProps,
  "documentType"
>;

export function DebitNoteForm(props: DebitNoteFormProps) {
  return <DocumentForm {...props} documentType="debit_note" />;
}