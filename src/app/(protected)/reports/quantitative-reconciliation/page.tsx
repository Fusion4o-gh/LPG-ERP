"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function QuantitativeReconciliationReportPage() {
  return (
    <ReportTableClient
      title="Quantitative Reconciliation"
      description="Physical bulk stock reconciliation by product and location: non-transit opening plus receipts less issues equals closing; transit is separate."
      endpoint="/api/reports/quantitative-reconciliation"
      dataKey="rows"
      showBulkProductFilter
      showLocationFilter
      columns={[
        { key: "product", label: "Product", render: (row) => `${(row.product as { code?: string; name?: string })?.code ?? ""} ${(row.product as { name?: string })?.name ?? ""}` },
        { key: "location", label: "Location", render: (row) => (row.location as { name?: string })?.name ?? "" },
        { key: "openingQuantity", label: "Opening" },
        { key: "receivedQuantity", label: "Received" },
        { key: "issuedQuantity", label: "Issued" },
        { key: "closingQuantity", label: "Closing" },
        { key: "inTransitQuantity", label: "In Transit" },
      ]}
    />
  );
}
