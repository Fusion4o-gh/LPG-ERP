"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function PurchaseReturnReportPage() {
  return (
    <ReportTableClient
      title="Purchase Return Report"
      description="Cylinder and other purchase returns between the selected date range."
      endpoint="/api/reports/purchase-return"
      dataKey="rows"
      showVendorFilter
      showItemFilter
      columns={[
        { key: "returnNo", label: "Return No" },
        { key: "transactionDate", label: "Date" },
        { key: "vendorCode", label: "Vendor Code" },
        { key: "vendorName", label: "Vendor Name" },
        { key: "itemCode", label: "Item Code" },
        { key: "itemName", label: "Item Name" },
        { key: "quantity", label: "Qty" },
        { key: "returnType", label: "Type" },
        { key: "returnAmount", label: "Amount" },
      ]}
    />
  );
}
