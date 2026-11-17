
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ReportCard } from "./shared/ReportCard";
import { ReportTable } from "./shared/ReportTable";
import { downloadCSV, today } from "./shared/report-utils";

export function StockReport() {
  const { data: rows = [] } = useQuery({
    queryKey: ["rep-stock"],
    queryFn: async () =>
      (await supabase
        .from("products")
        .select(
          "product_code, name, hsn_code, current_stock, min_stock, unit_price, uom",
        )
        .order("name")).data ?? [],
  });

  const enriched = rows.map((row: any) => ({
    ...row,
    value:
      Number(row.current_stock ?? 0) *
      Number(row.unit_price ?? 0),
    low:
      Number(row.current_stock ?? 0) <=
      Number(row.min_stock ?? 0),
  }));

  const totalValue = enriched.reduce(
    (total: number, row: any) => total + row.value,
    0,
  );

  return (
    <ReportCard
      title="Stock Valuation"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadCSV(`stock_${today()}.csv`, enriched)
          }
        >
          <Download className="mr-1 h-4 w-4" />
          CSV
        </Button>
      }
    >
      <ReportTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>HSN</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {enriched.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-6 text-center text-muted-foreground"
                >
                  No products.
                </TableCell>
              </TableRow>
            )}

            {enriched.map((row: any, index: number) => (
              <TableRow
                key={index}
                className={row.low ? "bg-warning/5" : ""}
              >
                <TableCell className="font-mono text-xs">
                  {row.product_code}
                </TableCell>
                <TableCell>
                  {row.name}
                  {row.low && (
                    <span className="ml-2 text-xs text-warning">
                      ● low
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {row.hsn_code ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(row.current_stock ?? 0)} {row.uom}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(row.unit_price)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {formatINR(row.value)}
                </TableCell>
              </TableRow>
            ))}

            {enriched.length > 0 && (
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={5} className="text-right">
                  Total Stock Value
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(totalValue)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ReportTable>
    </ReportCard>
  );
}
