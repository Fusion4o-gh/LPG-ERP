"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function CustomerCylinderBalanceReportPage() {
  return (
    <ReportTableClient
      title="Customer Cylinder Balance Report"
      description="Outstanding empty cylinders by customer and LPG item."
      endpoint="/api/reports/customer-cylinder-balances"
      dataKey="rows"
      showCustomerFilter
      showItemFilter
      columns={[
        { key: "customer", label: "Customer", render: (row) => `${(row.customer as { code?: string; name?: string })?.code ?? ""} ${(row.customer as { name?: string })?.name ?? ""}` },
        { key: "item", label: "Item", render: (row) => `${(row.item as { code?: string; name?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}` },
        { key: "outstandingEmptyCylinders", label: "Empty Outstanding" },
        { key: "lastMovementDate", label: "Last Movement", render: (row) => (row.lastMovementDate ? String(row.lastMovementDate).slice(0, 10) : "") },
      ]}
    />
  );
}
