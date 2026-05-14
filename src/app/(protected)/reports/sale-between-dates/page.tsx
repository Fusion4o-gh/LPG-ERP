"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function SaleBetweenDatesReportPage() {
  return (
    <ReportTableClient
      title="Sale B/W Date"
      description="Sales invoices between the selected date range."
      endpoint="/api/reports/sale-between-dates"
      dataKey="rows"
      showItemFilter
      showCustomerFilter
      columns={[
        { key: "issueNo", label: "Issue No" },
        { key: "transactionDate", label: "Date" },
        { key: "customerCode", label: "Customer Code" },
        { key: "customerName", label: "Customer Name" },
        { key: "totalQty", label: "Qty" },
        { key: "saleAmount", label: "Amount" },
        { key: "saleType", label: "Sale Type" },
      ]}
    />
  );
}
