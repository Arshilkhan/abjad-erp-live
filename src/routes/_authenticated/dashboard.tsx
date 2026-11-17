
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatINR,
  formatCompactINR,
  formatDate,
  billNo,
} from "@/lib/format";
import {
  IndianRupee,
  TrendingUp,
  AlertCircle,
  Users,
  Package,
  FileSpreadsheet,
  ShoppingCart,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ABJAD ERP" }] }),
  component: Dashboard,
});

// Indian financial year: April 1 – March 31.
// fyStart is the calendar year that April belongs to.
function currentFyStart() {
  const d = new Date();
  return d.getMonth() >= 3
    ? d.getFullYear()
    : d.getFullYear() - 1;
}

// Returns a local calendar date in YYYY-MM-DD format.
// Avoids UTC conversion shifting the date.
function getLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function useDashboardData(fyStart: number) {
  return useQuery({
    queryKey: ["dashboard", fyStart],

    queryFn: async () => {
      const today = new Date();

      // Actual invoice date, not creation/import date.
      const todayDate = getLocalDateString(today);

      // First day of the current calendar month.
      const startMonth = getLocalDateString(
        new Date(today.getFullYear(), today.getMonth(), 1),
      );

      // Selected financial year: April 1 to March 31.
      const fyFrom = `${fyStart}-04-01`;
      const fyTo = `${fyStart + 1}-04-01`;

      const [
        todaySales,
        monthSales,
        outstanding,
        customersCount,
        productsInv,
        pendingQuotes,
        recentInvoices,
        monthly,
      ] = await Promise.all([
        // Today's sales: invoices whose actual invoice date is today.
        supabase
          .from("invoices")
          .select("grand_total")
          .eq("invoice_type", "tax_invoice")
          .eq("invoice_date", todayDate),

        // Monthly sales: invoices dated from the first of this month
        // through today. Future-dated invoices are not included.
        supabase
          .from("invoices")
          .select("grand_total")
          .eq("invoice_type", "tax_invoice")
          .gte("invoice_date", startMonth)
          .lte("invoice_date", todayDate),

        // Outstanding receivables.
        supabase
          .from("invoices")
          .select("grand_total, amount_paid")
          .in("status", ["sent", "partial"]),

        // Total customers.
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true }),

        // Inventory valuation.
        supabase
          .from("products")
          .select("stock_quantity, purchase_price"),

        // Pending quotations.
        supabase
          .from("quotation")
          .select("id", { count: "exact", head: true })
          .eq("status", "sent"),

        // Recent invoices remain ordered by creation date.
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, customer_name_snapshot, grand_total, status, invoice_date",
          )
          .order("created_at", { ascending: false })
          .limit(5),

        // Monthly chart uses actual invoice dates.
        supabase
          .from("invoices")
          .select("invoice_date, grand_total, status")
          .gte("invoice_date", fyFrom)
          .lt("invoice_date", fyTo)
          .neq("status", "cancelled"),
      ]);

      // Sum invoice totals.
      const sum = (
        rows: { grand_total: number | null }[] | null,
      ) =>
        (rows ?? []).reduce(
          (total, row) =>
            total + Number(row.grand_total ?? 0),
          0,
        );

      // Outstanding amount.
      const outstandingTotal = (outstanding.data ?? []).reduce(
        (total, row) =>
          total +
          (Number(row.grand_total ?? 0) -
            Number(row.amount_paid ?? 0)),
        0,
      );

      // Inventory value.
      const inventoryValue = (productsInv.data ?? []).reduce(
        (total, row) =>
          total +
          Number(row.stock_quantity ?? 0) *
            Number(row.purchase_price ?? 0),
        0,
      );

      // Build 12 buckets covering April to March
      // of the selected financial year.
      const monthMap = new Map<string, number>();

      for (let i = 0; i < 12; i++) {
        const d = new Date(fyStart, 3 + i, 1);

        const key = `${d.getFullYear()}-${String(
          d.getMonth() + 1,
        ).padStart(2, "0")}`;

        monthMap.set(key, 0);
      }

      // Group invoices by their actual invoice date.
      (monthly.data ?? []).forEach((row) => {
        const key = String(row.invoice_date).slice(0, 7);

        if (monthMap.has(key)) {
          monthMap.set(
            key,
            (monthMap.get(key) ?? 0) +
              Number(row.grand_total ?? 0),
          );
        }
      });

      const chart = Array.from(monthMap.entries()).map(
        ([key, value]) => ({
          month: new Date(
            `${key}-01T00:00:00`,
          ).toLocaleDateString("en-IN", {
            month: "short",
          }),
          sales: value,
        }),
      );

      return {
        todaySales: sum(todaySales.data),
        monthSales: sum(monthSales.data),
        outstandingTotal,
        customersCount: customersCount.count ?? 0,
        inventoryValue,
        pendingQuotesCount: pendingQuotes.count ?? 0,
        recent: recentInvoices.data ?? [],
        chart,
      };
    },
  });
}

const statusStyles: Record<string, string> = {
  paid: "bg-[color:oklch(0.92_0.06_155)] text-[color:oklch(0.35_0.14_155)] border-transparent",
  sent: "bg-secondary text-secondary-foreground",
  partial:
    "bg-[color:oklch(0.94_0.09_75)] text-[color:oklch(0.40_0.15_75)] border-transparent",
  draft: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive border-transparent",
};

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  accent?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 w-1 ${
          accent ?? "bg-primary"
        }`}
      />

      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>

            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {value}
            </p>

            {sub && (
              <p className="mt-1 text-xs text-muted-foreground">
                {sub}
              </p>
            )}
          </div>

          <div className="rounded-md bg-secondary p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { isAdmin } = useAuth();

  const [fyStart, setFyStart] = useState<number>(
    currentFyStart(),
  );

  const { data, isLoading } = useDashboardData(fyStart);

  const fyOptions = useMemo(() => {
    const current = currentFyStart();

    return [
      current - 2,
      current - 1,
      current,
      current + 1,
    ];
  }, []);

  const fyLabel = `${fyStart}-${String(
    fyStart + 1,
  ).slice(-2)}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          isAdmin
            ? "Live snapshot of sales, inventory, and receivables."
            : "Your most recent invoices."
        }
      />

      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Today's Sales"
            value={formatINR(data?.todaySales ?? 0)}
            icon={IndianRupee}
          />

          <Kpi
            label="Monthly Sales"
            value={formatCompactINR(data?.monthSales ?? 0)}
            sub={formatINR(data?.monthSales ?? 0)}
            icon={TrendingUp}
            accent="bg-chart-2"
          />

          <Kpi
            label="Outstanding"
            value={formatCompactINR(
              data?.outstandingTotal ?? 0,
            )}
            sub={formatINR(data?.outstandingTotal ?? 0)}
            icon={AlertCircle}
            accent="bg-warning"
          />

          <Kpi
            label="Total Customers"
            value={String(data?.customersCount ?? 0)}
            icon={Users}
            accent="bg-chart-3"
          />

          <Kpi
            label="Inventory Value"
            value={formatCompactINR(
              data?.inventoryValue ?? 0,
            )}
            sub={formatINR(data?.inventoryValue ?? 0)}
            icon={Package}
            accent="bg-chart-2"
          />

          <Kpi
            label="Pending Quotations"
            value={String(data?.pendingQuotesCount ?? 0)}
            icon={FileSpreadsheet}
            accent="bg-chart-4"
          />

          <Kpi
            label="Pending POs"
            value="0"
            icon={ShoppingCart}
            accent="bg-chart-5"
          />

          <Kpi
            label="Financial Year"
            value={fyLabel}
            sub="April – March"
            icon={TrendingUp}
          />
        </div>
      )}

      <div
        className={`mt-6 grid gap-4 ${
          isAdmin ? "lg:grid-cols-3" : ""
        }`}
      >
        {isAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                Monthly Sales — FY {fyLabel}
              </CardTitle>

              <Select
                value={String(fyStart)}
                onValueChange={(value) =>
                  setFyStart(Number(value))
                }
              >
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {fyOptions.map((year) => (
                    <SelectItem
                      key={year}
                      value={String(year)}
                    >
                      FY {year}-{String(year + 1).slice(-2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>

            <CardContent>
              <div className="h-64">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart data={data?.chart ?? []}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="month"
                      stroke="#64748b"
                      fontSize={12}
                    />

                    <YAxis
                      stroke="#64748b"
                      fontSize={12}
                      tickFormatter={(value) =>
                        formatCompactINR(value as number)
                      }
                    />

                    <Tooltip
                      formatter={(value) => [
                        formatINR(Number(value)),
                        "Sales",
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    />

                    <Bar
                      dataKey="sales"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Recent Invoices
            </CardTitle>

            <Link
              to="/invoices"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-5 text-sm text-muted-foreground">
                Loading…
              </p>
            ) : (data?.recent ?? []).length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                No invoices yet.{" "}
                <Link
                  to="/invoices"
                  className="text-primary hover:underline"
                >
                  Create one
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y">
                {data!.recent.map((invoice: any) => (
                  <li
                    key={invoice.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">
                        {billNo(invoice.invoice_number)}
                      </p>

                      <p className="truncate text-xs text-muted-foreground">
                        {invoice.customer_name_snapshot ?? "—"} •{" "}
                        {formatDate(invoice.invoice_date)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatINR(invoice.grand_total)}
                      </p>

                      <Badge
                        variant="outline"
                        className={`mt-1 text-[10px] font-medium uppercase ${
                          statusStyles[invoice.status] ?? ""
                        }`}
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
