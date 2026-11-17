import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { SalesReport } from "@/components/reports/SalesReport";
import { GstReport } from "@/components/reports/GstReport";
import { CustomerLedger } from "@/components/reports/CustomerLedger";
import { StockReport } from "@/components/reports/StockReport";
import { OutstandingReport } from "@/components/reports/OutstandingReport";
import { CancelledReport } from "@/components/reports/CancelledReport";
import { RejectedReport } from "@/components/reports/RejectedReport";
import { CustomerCreditsReport } from "@/components/reports/CustomerCreditsReport";
import { ChargesReport } from "@/components/reports/ChargesReport";
import { ImportsReport } from "@/components/reports/ImportsReport";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [{ title: "Reports — ABJAD ERP" }],
  }),
  component: ReportsPage,
});

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getFinancialYearStart = () => {
  const now = new Date();
  const year =
    now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  return `${year}-04-01`;
};

function ReportsPage() {
  const [from, setFrom] = useState(getFinancialYearStart);
  const [to, setTo] = useState(getLocalDate);

  const dateRange = {
    from,
    to,
    onFrom: setFrom,
    onTo: setTo,
  };

  return (
    <>
      <PageHeader
        title="Reports"
        description="Sales, GST, customer ledger, stock, cancellations, rejections, credits, charges — export to CSV."
      />

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="gst">GST (GSTR-1)</TabsTrigger>
          <TabsTrigger value="ledger">Customer Ledger</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="rejected">Rejected Items</TabsTrigger>
          <TabsTrigger value="credits">Customer Credits</TabsTrigger>
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="imports">Imported</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReport {...dateRange} />
        </TabsContent>

        <TabsContent value="gst">
          <GstReport {...dateRange} />
        </TabsContent>

        <TabsContent value="ledger">
          <CustomerLedger />
        </TabsContent>

        <TabsContent value="stock">
          <StockReport />
        </TabsContent>

        <TabsContent value="outstanding">
          <OutstandingReport {...dateRange} />
        </TabsContent>

        <TabsContent value="cancelled">
          <CancelledReport {...dateRange} />
        </TabsContent>

        <TabsContent value="rejected">
          <RejectedReport {...dateRange} />
        </TabsContent>

        <TabsContent value="credits">
          <CustomerCreditsReport />
        </TabsContent>

        <TabsContent value="charges">
          <ChargesReport {...dateRange} />
        </TabsContent>

        <TabsContent value="imports">
          <ImportsReport {...dateRange} />
        </TabsContent>
      </Tabs>
    </>
  );
}
