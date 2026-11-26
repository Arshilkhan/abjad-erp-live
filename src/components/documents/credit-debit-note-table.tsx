
import { useMemo, useState } from "react";
import { Pencil, Ban, Plus, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { formatINR, formatDate, billNo } from "@/lib/format";

type NoteType = "credit_note" | "debit_note";
type SortField = "number" | "type" | "customer" | "date" | "total";

export type CreditDebitNoteRow = {
  id: string;
  note_number: string;
  type: NoteType;
  note_date: string;
  customer_name_snapshot: string | null;
  grand_total: number | string | null;
  status: string;
};

type CreditDebitNoteTableProps = {
  rows: CreditDebitNoteRow[];
  isLoading?: boolean;
  canCreate?: boolean;
  onCreate?: () => void;
  onOpen?: (row: CreditDebitNoteRow) => void;
  onEdit?: (row: CreditDebitNoteRow) => void;
  onCancel?: (row: CreditDebitNoteRow) => void;
};

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/10 text-destructive border-transparent",
};

export function CreditDebitNoteTable({
  rows,
  isLoading = false,
  canCreate = false,
  onCreate,
  onOpen,
  onEdit,
  onCancel,
}: CreditDebitNoteTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(() => {
    const saved = localStorage.getItem(
      "abjad-erp-credit-debit-note-sort-field",
    );

    return saved === "number" ||
      saved === "type" ||
      saved === "customer" ||
      saved === "date" ||
      saved === "total"
      ? saved
      : null;
  });

  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    () => {
      const saved = localStorage.getItem(
        "abjad-erp-credit-debit-note-sort-direction",
      );

      return saved === "desc" ? "desc" : "asc";
    },
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      const nextDirection =
        sortDirection === "asc" ? "desc" : "asc";

      setSortDirection(nextDirection);

      localStorage.setItem(
        "abjad-erp-credit-debit-note-sort-direction",
        nextDirection,
      );
    } else {
      setSortField(field);
      setSortDirection("asc");

      localStorage.setItem(
        "abjad-erp-credit-debit-note-sort-field",
        field,
      );

      localStorage.setItem(
        "abjad-erp-credit-debit-note-sort-direction",
        "asc",
      );
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortField) return rows;

    return [...rows].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "number":
          comparison = String(a.note_number ?? "").localeCompare(
            String(b.note_number ?? ""),
            undefined,
            { numeric: true, sensitivity: "base" },
          );
          break;

        case "type":
          comparison = String(a.type ?? "").localeCompare(
            String(b.type ?? ""),
          );
          break;

        case "customer":
          comparison = String(
            a.customer_name_snapshot ?? "",
          ).localeCompare(
            String(b.customer_name_snapshot ?? ""),
            undefined,
            { sensitivity: "base" },
          );
          break;

        case "date":
          comparison =
            new Date(a.note_date).getTime() -
            new Date(b.note_date).getTime();
          break;

        case "total":
          comparison =
            Number(a.grand_total ?? 0) -
            Number(b.grand_total ?? 0);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rows, sortField, sortDirection]);

  const SortableHead = ({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={`cursor-pointer select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  );

  return (
    <div className="mx-3">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="number">Note #</SortableHead>

            <SortableHead field="type">Type</SortableHead>

            <SortableHead field="customer">Customer</SortableHead>

            <SortableHead field="date">Date</SortableHead>

            <SortableHead field="total" className="text-right">
              Total
            </SortableHead>

            <TableHead>Status</TableHead>

            <TableHead className="w-24 text-right">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-muted-foreground"
              >
                Loading…
              </TableCell>
            </TableRow>
          )}

          {!isLoading && rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-10 text-center text-muted-foreground"
              >
                No credit or debit notes here yet.
                {canCreate && onCreate && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={onCreate}
                      className="text-primary hover:underline"
                    >
                      Create one
                    </button>.
                  </>
                )}
              </TableCell>
            </TableRow>
          )}

          {sortedRows.map((row) => {
            const isCreditNote = row.type === "credit_note";

            return (
              <TableRow
                key={row.id}
                className={`hover:bg-muted/40 ${
                  row.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <TableCell className="font-mono text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => onOpen?.(row)}
                    className="text-primary hover:underline"
                  >
                    {billNo(row.note_number)}
                  </button>
                </TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      isCreditNote
                        ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
                        : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300"
                    }
                  >
                    {isCreditNote ? "Credit Note" : "Debit Note"}
                  </Badge>
                </TableCell>

                <TableCell>
                  {row.customer_name_snapshot ?? "—"}
                </TableCell>

                <TableCell>{formatDate(row.note_date)}</TableCell>

                <TableCell className="text-right font-semibold tabular-nums">
                  {formatINR(Number(row.grand_total ?? 0))}
                </TableCell>

                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium uppercase ${
                      statusStyles[row.status] ?? ""
                    }`}
                  >
                    {row.status}
                  </Badge>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {row.status !== "cancelled" && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Edit"
                          disabled={!onEdit}
                          onClick={() => onEdit?.(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          title="Cancel note"
                          disabled={!onCancel}
                          onClick={() => onCancel?.(row)}
                        >
                          <Ban className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

    </div>
  );
}
