import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Folder, Search, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaxInvoiceTable } from "@/components/documents/tax-invoice-table";
import { useInvoiceFolders } from "@/lib/invoice-folders";
import { formatINR, formatDate } from "@/lib/format";
import { FinancialYearSelector } from "@/components/reports/shared/FinancialYearSelector";
import { useFinancialYears } from "@/components/reports/shared/useFinancialYears";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({ meta: [{ title: "Invoices — ABJAD ERP" }] }),
  component: InvoicesLayout,
});

function InvoicesLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (path !== "/invoices") return <Outlet />;
  return <InvoicesIndex />;
}

function InvoicesIndex() {
  const {
    financialYears,
    selectedFinancialYear,
    selectedFinancialYearId,
    setSelectedFinancialYearId,
    isLoading: isFinancialYearsLoading,
  } = useFinancialYears();

  const { folders, isLoading: isInvoicesLoading } = useInvoiceFolders({
    table: "invoices",
    kind: "tax_invoice",
    financialYear: selectedFinancialYear,
  });

  const isLoading = isFinancialYearsLoading || isInvoicesLoading;
  const [q, setQ] = useState("");
  const [view, setView] = useState<"folders" | "all">("folders");

  useEffect(() => {
    const saved = window.localStorage.getItem("abjad-erp-invoices-view");
    if (saved === "all" || saved === "folders") setView(saved);
  }, []);

  const changeView = (next: "folders" | "all") => {
    setView(next);
    window.localStorage.setItem("abjad-erp-invoices-view", next);
  };

  const s = q.trim().toLowerCase();
  const visibleFolders = folders.filter((f) => !s || f.name.toLowerCase().includes(s));
  const allRows = folders.flatMap((f) => f.rows).filter((r: any) =>
    !s || [r.invoice_number, r.customer_name_snapshot, r.po_number, r.challan_number]
      .filter(Boolean)
      .some((v: string) => String(v).toLowerCase().includes(s)),
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Documents organised into a folder per company."
        actions={
          <div className="flex gap-1 rounded-md border p-0.5">
            <Button size="sm" variant={view === "folders" ? "secondary" : "ghost"} onClick={() => changeView("folders")}>
              <LayoutGrid className="mr-1 h-4 w-4" /> Folders
            </Button>
            <Button size="sm" variant={view === "all" ? "secondary" : "ghost"} onClick={() => changeView("all")}>
              <List className="mr-1 h-4 w-4" /> All documents
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder={view === "folders" ? "Search companies…" : "Search documents…"}
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

      {view === "all" ? (
        <Card><CardContent className="p-0"><TaxInvoiceTable rows={allRows} isLoading={isLoading} /></CardContent></Card>
      ) : isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : visibleFolders.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          No company folders yet. <Link to="/invoices/new" className="text-primary hover:underline">Create an invoice</Link> to start one.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFolders.map((f) => (
            <Link key={f.slug} to="/invoices/folder/$company" params={{ company: f.slug }}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="rounded-md bg-primary/10 p-2 text-primary"><Folder className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.rows.length} document{f.rows.length === 1 ? "" : "s"}
                      {f.lastDate ? ` • last ${formatDate(f.lastDate)}` : ""}
                    </div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">{formatINR(f.total)}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
