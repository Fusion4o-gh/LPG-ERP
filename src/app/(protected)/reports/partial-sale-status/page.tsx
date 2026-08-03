"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function PartialSaleStatusReportPage() {
  return <ReportTableClient title="Partial Sale Status Report" description="Partial receiving quantities, receipts, remaining balances, and arrival status." endpoint="/api/reports/partial-sale-status" dataKey="rows" showBulkProductFilter showLocationFilter columns={[
    { key: "documentNo", label: "Document No" }, { key: "date", label: "Date" }, { key: "plant", label: "Plant", render: (row) => (row.plant as { name?: string })?.name ?? "" }, { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" }, { key: "totalQuantity", label: "Total" }, { key: "receivedQuantity", label: "Received" }, { key: "remainingQuantity", label: "Remaining" }, { key: "status", label: "Status" }, { key: "saleStatus", label: "Sale Status" },
  ]} />;
}
