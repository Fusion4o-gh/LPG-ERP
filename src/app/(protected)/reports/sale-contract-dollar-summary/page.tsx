"use client";
import { ReportTableClient } from "../ReportTableClient";

export default function SaleContractDollarSummaryPage() {
  return <ReportTableClient title="Sale Contract Summary (Dollar)" description="Dollar sale contracts with quantity, delivery, USD rate, and status details." endpoint="/api/reports/sale-contract-dollar-summary" dataKey="rows" showBulkProductFilter showCustomerFilter columns={[{ key: "contractNo", label: "Contract" }, { key: "date", label: "Date" }, { key: "customer", label: "Customer", render: (row) => (row.customer as { name?: string })?.name ?? "" }, { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" }, { key: "quantity", label: "Quantity" }, { key: "deliveredQuantity", label: "Delivered" }, { key: "remainingQuantity", label: "Remaining" }, { key: "rateUsd", label: "USD Rate" }, { key: "amountUsd", label: "USD Amount" }, { key: "saleStatus", label: "Status" }]} />;
}
