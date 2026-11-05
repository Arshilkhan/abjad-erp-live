export const PANELS = [
  { key: "dashboard", label: "Dashboard", url: "/dashboard" },
  { key: "invoices", label: "Invoices", url: "/invoices" },
  { key: "proforma-form", label: "Proforma Invoices", url: "/proformas" }, //Newly added
  { key: "quotations", label: "Quotations", url: "/quotations" },
  { key: "challans", label: "Challans", url: "/challans" },
  { key: "purchases", label: "Purchases", url: "/purchases" },
  { key: "cancelled-invoices", label: "Cancelled Invoices", url: "/cancelled-invoices" },
  { key: "rejected-items", label: "Rejected Items", url: "/rejected-items" },
  { key: "customers", label: "Customers", url: "/customers" },
  { key: "products", label: "Products", url: "/products" },
  { key: "inventory", label: "Inventory", url: "/inventory" },
  { key: "customer-credits", label: "Customer Credits", url: "/customer-credits" },
  { key: "payments", label: "Payments", url: "/payments" },
  { key: "reports", label: "Reports", url: "/reports" },
  { key: "settings", label: "Settings", url: "/settings" },
  { key: "backups", label: "Backups", url: "/backups" },
] as const;

export type PanelKey = (typeof PANELS)[number]["key"];

export const ADMIN_ROLES = ["super_admin", "admin"];
