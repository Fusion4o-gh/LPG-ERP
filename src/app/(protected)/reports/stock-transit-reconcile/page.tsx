"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function StockTransitReconcileReportPage() {
  return (
    <ReportTableClient title="Stock In Transit Reconcile" description="Compare in-transit ledger balances with outstanding loading documents." endpoint="/api/reports/stock-transit-reconcile" dataKey="rows" showBulkProductFilter columns={[
      { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" },
      { key: "location", label: "Location", render: (row) => (row.location as { name?: string })?.name ?? "" },
      { key: "ledgerTransit", label: "Ledger Transit" },
      { key: "documentTransit", label: "Document Transit" },
      { key: "difference", label: "Difference" },
    ]} />
  );
}
