"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function ClosingStockSummaryReportPage() {
  return (
    <ReportTableClient
      title="Closing Stock Summary"
      description="Opening, received, issued, and closing cylinder quantities by item, state, and stock location."
      endpoint="/api/reports/closing-stock-summary"
      dataKey="rows"
      showItemFilter
      columns={[
        { key: "item", label: "Item", render: (row) => `${(row.item as { code?: string; name?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}` },
        { key: "cylinderState", label: "State" },
        { key: "location", label: "Location", render: (row) => (row.location as { code?: string; name?: string })?.code ?? "Unassigned" },
        { key: "openingQuantity", label: "Opening" },
        { key: "receivedQuantity", label: "Received" },
        { key: "issuedQuantity", label: "Issued" },
        { key: "closingQuantity", label: "Closing" },
      ]}
    />
  );
}
