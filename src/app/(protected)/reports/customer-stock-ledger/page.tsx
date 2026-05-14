"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function CustomerStockLedgerReportPage() {
  return (
    <ReportTableClient
      title="Customer Stock Ledger"
      description="All cylinder movements for a customer between the selected date range."
      endpoint="/api/reports/customer-stock-ledger"
      dataKey="rows"
      showCustomerFilter
      showItemFilter
      columns={[
        { key: "transactionDate", label: "Date" },
        { key: "documentNo", label: "Document No" },
        { key: "sourceType", label: "Type" },
        { key: "itemCode", label: "Item Code" },
        { key: "itemName", label: "Item Name" },
        { key: "cylinderState", label: "State" },
        { key: "direction", label: "Direction" },
        { key: "quantity", label: "Qty" },
        { key: "balanceAfter", label: "Balance After" },
        { key: "remarks", label: "Remarks" },
      ]}
    />
  );
}
