"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function VendorWiseReceivingReportPage() {
  return (
    <ReportTableClient
      title="Vendor Wise Receiving Report"
      description="Incoming stock from vendors between the selected date range."
      endpoint="/api/reports/vendor-wise-receiving"
      dataKey="rows"
      showVendorFilter
      showItemFilter
      columns={[
        { key: "receiptNo", label: "Receipt No" },
        { key: "transactionDate", label: "Date" },
        { key: "vendorCode", label: "Vendor Code" },
        { key: "vendorName", label: "Vendor Name" },
        { key: "itemCode", label: "Item Code" },
        { key: "itemName", label: "Item Name" },
        { key: "cylinderState", label: "State" },
        { key: "quantity", label: "Qty" },
        { key: "purchaseAmount", label: "Amount" },
      ]}
    />
  );
}
