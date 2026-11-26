import { DocumentForm, type DocumentFormProps } from "./document-form";

export type CreditNoteFormProps = Omit<
  DocumentFormProps,
  "documentType"
>;

export function CreditNoteForm(props: CreditNoteFormProps) {
  return <DocumentForm {...props} documentType="credit_note" />;
}