
import {
  createFileRoute,
  Outlet,
  useNavigate,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { PANELS } from "@/lib/panels";
import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import {
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Plus,
  ShoppingCart,
  Truck,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user, loading, isAdmin, canAccess, canPerform } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  const matched = [...PANELS]
    .sort((a, b) => b.url.length - a.url.length)
    .find((p) => path === p.url || path.startsWith(p.url + "/"));

  const allowed = isAdmin || !matched || canAccess(matched.key);
  const canCreateInvoice = canPerform("tax_invoice", "create");
  const canCreateProforma = canPerform("proforma", "create");
  const canCreateQuotation = canPerform("quotation", "create");
  const canCreateChallan = canPerform("delivery_challan", "create");
  const canCreateCreditNote = canPerform("credit_note", "create");
  const canCreateDebitNote = canPerform("debit_note", "create");
  const canCreatePO = canAccess("purchases");

  const showCreateMenu =
    canCreateInvoice ||
    canCreateProforma ||
    canCreateQuotation ||
    canCreateChallan ||
    canCreateCreditNote ||
    canCreateDebitNote ||
    canCreatePO;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <SidebarInset className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <GlobalSearch />

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {showCreateMenu && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" aria-label="Create document">
                      <Plus className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Create</span>
                      <ChevronDown className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="end" className="w-56">
                    {canCreateInvoice && (
                      <DropdownMenuItem asChild>
                        <Link to="/invoices/new">
                          <FileText /> New Invoice
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {canCreateProforma && (
                      <DropdownMenuItem asChild>
                        <Link to="/proformas/new">
                          <FileText /> New Proforma
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {canCreateQuotation && (
                      <DropdownMenuItem asChild>
                        <Link to="/quotations/new">
                          <FileSpreadsheet /> New Quotation
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {canCreateChallan && (
                      <DropdownMenuItem asChild>
                        <Link to="/challans/new">
                          <Truck /> New Challan
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {(canCreateCreditNote || canCreateDebitNote) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>
                          Credit / Debit Notes
                        </DropdownMenuLabel>
                      </>
                    )}

                    {canCreateCreditNote && (
                      <DropdownMenuItem asChild>
                        <Link to="/credit-debit-notes/new" search={{ kind: "credit_note" }}>
                          <FileText /> New Credit Note
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {canCreateDebitNote && (
                      <DropdownMenuItem asChild>
                        <Link to="/credit-debit-notes/new" search={{ kind: "debit_note" }}>
                          <FileText /> New Debit Note
                        </Link>
                      </DropdownMenuItem>
                    )}

                    {canCreatePO && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/purchases/new">
                            <ShoppingCart /> New PO
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </header>

          <main className="flex-1 p-6">
            {allowed ? (
              <Outlet />
            ) : (
              <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
                You don't have permission to access this section.
              </div>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
