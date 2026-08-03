"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function StockAdjustmentReportPage() {
  return <ReportTableClient title="Stock Adjustment Report" description="Loss/gain and stock adjustment quantities with financial impact and posting status." endpoint="/api/reports/stock-adjustment" dataKey="rows" showBulkProductFilter showLocationFilter columns={[
    { key: "documentNo", label: "Document No" }, { key: "date", label: "Date" }, { key: "type", label: "Type" },
    { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" }, { key: "location", label: "Location", render: (row) => (row.location as { name?: string })?.name ?? "" },
    { key: "expectedQuantity", label: "Expected" }, { key: "actualQuantity", label: "Actual" }, { key: "difference", label: "Difference" }, { key: "financialImpact", label: "Financial Impact" }, { key: "status", label: "Status" }, { key: "postedToPl", label: "Posted To P&L" },
  ]} />;
}
