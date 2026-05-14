"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function SaleReturnReportPage() {
  return (
    <ReportTableClient
      title="Sale Return Report"
      description="Cylinder return records between the selected date range."
      endpoint="/api/reports/sale-return"
      dataKey="rows"
      showItemFilter
      showCustomerFilter
      columns={[
        { key: "returnNo", label: "Return No" },
        { key: "transactionDate", label: "Date" },
        { key: "customerCode", label: "Customer Code" },
        { key: "customerName", label: "Customer Name" },
        { key: "itemCode", label: "Item Code" },
        { key: "itemName", label: "Item Name" },
        { key: "filledReturned", label: "Filled Returned" },
        { key: "emptyReturned", label: "Empty Returned" },
      ]}
    />
  );
}
