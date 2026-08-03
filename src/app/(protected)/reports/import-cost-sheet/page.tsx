"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function ImportCostSheetReportPage() {
  return (
    <ReportTableClient
      title="Import Cost Sheet"
      description="Import loading rates, freight, final landed rate, and calculated costs by shipment."
      endpoint="/api/reports/import-cost-sheet"
      dataKey="rows"
      showBulkProductFilter
      showImportTypeFilter
      columns={[
        { key: "loadingNo", label: "Loading No" },
        { key: "loadingDate", label: "Date" },
        { key: "contractNo", label: "Contract No" },
        { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" },
        { key: "quantityLoaded", label: "Loaded Qty" },
        { key: "arrivedQuantity", label: "Arrived Qty" },
        { key: "rate", label: "Rate" },
        { key: "freight", label: "Freight" },
        { key: "finalRate", label: "Final Rate" },
        { key: "totalFreight", label: "Total Freight" },
        { key: "totalCost", label: "Total Cost" },
        { key: "arrivedCost", label: "Arrived Cost" },
      ]}
    />
  );
}
