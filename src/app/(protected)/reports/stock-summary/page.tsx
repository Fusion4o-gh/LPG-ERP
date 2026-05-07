import { ReportTableClient } from "../ReportTableClient";

export default function StockSummaryReportPage() {
  return (
    <ReportTableClient
      title="Stock Summary"
      description="Filled and empty cylinder quantities calculated from immutable stock ledger entries."
      endpoint="/api/reports/stock-summary"
      dataKey="rows"
      showItemFilter
      columns={[
        { key: "item", label: "Item", render: (row) => `${(row.item as { code?: string; name?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}` },
        { key: "filledQuantity", label: "Filled Qty" },
        { key: "emptyQuantity", label: "Empty Qty" },
        { key: "netMovement", label: "Net Movement" },
      ]}
    />
  );
}
