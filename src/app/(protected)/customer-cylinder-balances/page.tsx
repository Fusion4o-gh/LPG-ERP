"use client";

import { EntityList } from "@/components/EntityList";

export default function CustomerCylinderBalancesPage() {
  return (
    <EntityList
      title="Customer Cylinder Balance"
      description="Customer-wise filled and empty cylinder accountability with security held."
      endpoint="/api/customer-cylinder-balances"
      dataKey="balances"
      columns={[
        { key: "customer", label: "Customer", render: (row) => `${(row.customer as { code?: string })?.code ?? ""} ${(row.customer as { name?: string })?.name ?? ""}` },
        { key: "item", label: "Item", render: (row) => `${(row.item as { code?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}` },
        { key: "filledOutstanding", label: "Filled Outstanding" },
        { key: "emptyOwed", label: "Empty Owed" },
        { key: "securityHeld", label: "Security Held" },
        { key: "lastMovementDate", label: "Last Movement", render: (row) => (row.lastMovementDate ? String(row.lastMovementDate).slice(0, 10) : "") },
      ]}
    />
  );
}
