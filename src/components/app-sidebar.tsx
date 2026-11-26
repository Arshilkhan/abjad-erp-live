import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, FileText, FileSpreadsheet, ReceiptText, Users, Package, Warehouse, ShoppingCart, Wallet, BarChart3, Settings, Factory, Ban, PackageX,
  CreditCard, UserCog, Truck, CloudUpload,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const main = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, panel: "dashboard" },
  { title: "Invoices", url: "/invoices", icon: ReceiptText, panel: "invoices" },
  { title: "Credit / Debit Notes", url: "/credit-debit-notes", icon: FileText, panel: "credit-debit-notes" },
  { title: "Proforma Invoices", url: "/proformas", icon: FileText, panel: "invoices" },
  { title: "Quotations", url: "/quotations", icon: FileSpreadsheet, panel: "quotations" },
  { title: "Challans", url: "/challans", icon: Truck, panel: "challans" },
  { title: "Purchases", url: "/purchases", icon: ShoppingCart, panel: "purchases" },
  { title: "Cancelled Invoices", url: "/cancelled-invoices", icon: Ban, panel: "cancelled-invoices" },
  { title: "Rejected Items", url: "/rejected-items", icon: PackageX, panel: "rejected-items" },
  { title: "Customers", url: "/customers", icon: Users, panel: "customers" },
  { title: "Products", url: "/products", icon: Package, panel: "products" },
  { title: "Inventory", url: "/inventory", icon: Warehouse, panel: "inventory" },
  { title: "Customer Credits", url: "/customer-credits", icon: CreditCard, panel: "customer-credits" },
  { title: "Payments", url: "/payments", icon: Wallet, panel: "payments" },
  { title: "Reports", url: "/reports", icon: BarChart3, panel: "reports" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname: path, search } = useRouterState({
    select: (r) => r.location,
  });
  const { user, signOut, isAdmin, canAccess } = useAuth();
  const visible = main.filter((i) => canAccess(i.panel));

  const documentKind =
    (search as { kind?: string }).kind ?? "tax_invoice";

  const isActive = (u: string) => {
    if (path.startsWith("/invoices/")) {
      if (u === "/invoices") return documentKind === "tax_invoice";
      if (u === "/proformas") return documentKind === "proforma";
      if (u === "/quotations") return documentKind === "quotation";
      if (u === "/challans") return documentKind === "delivery_challan";
    }

    return path === u || path.startsWith(u + "/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Factory className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">ABJAD</span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">Engineering Works</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {(canAccess("settings") || isAdmin) && (
          <SidebarGroup>
            <SidebarGroupLabel>Configuration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {canAccess("settings") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/settings")}>
                      <Link to="/settings">
                        <Settings className="h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/backups")}>
                      <Link to="/backups">
                        <CloudUpload className="h-4 w-4" />
                        <span>Backups</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/users")}>
                      <Link to="/users">
                        <UserCog className="h-4 w-4" />
                        <span>Users</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 py-2 text-xs">
            <div className="truncate font-medium text-sidebar-foreground">{user.email}</div>
            <Button
              onClick={() => signOut()}
              variant="ghost"
              size="sm"
              className="mt-1 h-7 w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Sign out
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
