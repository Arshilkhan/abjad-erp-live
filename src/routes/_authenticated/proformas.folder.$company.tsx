import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProformaTable } from "@/components/documents/proforma-table";
import { useInvoiceFolders } from "@/lib/invoice-folders";
import { formatINR } from "@/lib/format";
import { FinancialYearSelector } from "@/components/reports/shared/FinancialYearSelector";
import { useFinancialYears } from "@/components/reports/shared/useFinancialYears";

export const Route = createFileRoute("/_authenticated/proformas/folder/$company")({
  head: () => ({ meta: [{ title: "Proforma Company Folder — ABJAD ERP" }] }),
  component: ProformaFolderPage,
});

function ProformaFolderPage() {
  const { company } = useParams({
    from: "/_authenticated/proformas/folder/$company",
  });

  const {
    financialYears,
    selectedFinancialYear,
    selectedFinancialYearId,
    setSelectedFinancialYearId,
    isLoading: isFinancialYearsLoading,
  } = useFinancialYears();

  const { folders, isLoading: isDocumentsLoading } = useInvoiceFolders({
    table: "performa",
    kind: "proforma",
    financialYear: selectedFinancialYear,
  });

  const isLoading = isFinancialYearsLoading || isDocumentsLoading;

  const [q, setQ] = useState("");
  const folder = folders.find((f) => f.slug === company);

  const rows = (folder?.rows ?? []).filter((r: any) =>
    !q ||
    [r.invoice_number, r.customer_name_snapshot]
      .filter(Boolean)
      .some((v: string) =>
        String(v).toLowerCase().includes(q.toLowerCase()),
      ),
  );

  return (
    <>
      <PageHeader
        title={folder?.name ?? decodeURIComponent(company)}
        description={
          folder
            ? `${folder.rows.length} document${folder.rows.length === 1 ? "" : "s"} • ${formatINR(folder.total)} billed`
            : "Folder"
        }
      />

      <Link
        to="/proformas"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        All folders
      </Link>

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9"
                placeholder="Search in this folder…"
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

          <ProformaTable rows={rows} isLoading={isLoading} />
        </CardContent>
      </Card>
    </>
  );
}
