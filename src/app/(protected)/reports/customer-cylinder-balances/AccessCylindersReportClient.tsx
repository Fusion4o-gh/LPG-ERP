"use client";

import { useState } from "react";
import { ReportTableClient } from "../ReportTableClient";

type Tab = "customers" | "own-business";

export function AccessCylindersReportClient() {
  const [tab, setTab] = useState<Tab>("customers");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" data-print-hidden>
        <button
          type="button"
          onClick={() => setTab("customers")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "customers" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          LPG Access Cylinders (Customers)
        </button>
        <button
          type="button"
          onClick={() => setTab("own-business")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "own-business" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          LPG Access Cylinders (Own Business)
        </button>
      </div>

      {tab === "customers" ? (
        <ReportTableClient
          title="Access Cylinders Report"
          description="Outstanding empty cylinders by customer and LPG item."
          endpoint="/api/reports/customer-cylinder-balances"
          dataKey="rows"
          showCustomerFilter
          showItemFilter
          columns={[
            {
              key: "customer",
              label: "Customer",
              render: (row) =>
                `${(row.customer as { code?: string; name?: string })?.code ?? ""} ${(row.customer as { name?: string })?.name ?? ""}`,
            },
            {
              key: "item",
              label: "Item",
              render: (row) =>
                `${(row.item as { code?: string; name?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}`,
            },
            { key: "outstandingEmptyCylinders", label: "Empty Outstanding" },
            {
              key: "lastMovementDate",
              label: "Last Movement",
              render: (row) => (row.lastMovementDate ? String(row.lastMovementDate).slice(0, 10) : ""),
            },
          ]}
        />
      ) : (
        <ReportTableClient
          title="Access Cylinders Report"
          description="Own-business filled and empty cylinder stock up to the selected date."
          endpoint="/api/reports/stock-summary"
          dataKey="rows"
          showItemFilter
          columns={[
            {
              key: "item",
              label: "Item",
              render: (row) =>
                `${(row.item as { code?: string; name?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}`,
            },
            { key: "filledQuantity", label: "Filled Qty" },
            { key: "emptyQuantity", label: "Empty Qty" },
            { key: "netMovement", label: "Net Movement" },
          ]}
        />
      )}
    </div>
  );
}
