"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function OneCustomerSaleHistoryReportPage() {
  return (
    <ReportTableClient
      title="One Customer Sale History"
      description="Complete sale history for a single customer."
      endpoint="/api/reports/one-customer-sale-history"
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
