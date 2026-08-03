"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function ConsumptionReportPage() {
  return (
    <ReportTableClient
      title="Consumption Report"
      description="Bulk product consumption from posted non-transit stock issues, grouped by source and location."
      endpoint="/api/reports/consumption"
      dataKey="rows"
      showBulkProductFilter
      showLocationFilter
      columns={[
        { key: "product", label: "Product", render: (row) => `${(row.product as { code?: string; name?: string })?.code ?? ""} ${(row.product as { name?: string })?.name ?? ""}` },
        { key: "location", label: "Location", render: (row) => (row.location as { name?: string })?.name ?? "" },
        { key: "sourceType", label: "Source Type" },
        { key: "quantityConsumed", label: "Quantity Consumed" },
        { key: "transactionCount", label: "Transactions" },
      ]}
    />
  );
}
