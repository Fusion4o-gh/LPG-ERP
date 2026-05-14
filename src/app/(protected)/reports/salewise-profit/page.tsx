"use client";

import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

function percent(value: unknown) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export default function SalewiseProfitReportPage() {
  return (
    <ReportTableClient
      title="Salewise Profit"
      description="Gross profit per sale line. Cost is estimated using weighted-average purchase cost for the financial year."
      endpoint="/api/reports/salewise-profit"
      dataKey="rows"
      showCustomerFilter
      showItemFilter
      columns={[
        { key: "issueNo", label: "Issue No" },
        { key: "transactionDate", label: "Date" },
        { key: "customerName", label: "Customer" },
        { key: "itemName", label: "Item" },
        { key: "quantity", label: "Qty" },
        { key: "saleAmount", label: "Sale Amount", render: (row) => money(row.saleAmount) },
        { key: "costAmount", label: "Est. Cost", render: (row) => money(row.costAmount) },
        { key: "grossProfit", label: "Gross Profit", render: (row) => money(row.grossProfit) },
        { key: "profitPercent", label: "Profit %", render: (row) => percent(row.profitPercent) },
      ]}
    />
  );
}
