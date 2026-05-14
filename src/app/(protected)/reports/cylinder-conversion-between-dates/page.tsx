"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function CylinderConversionBetweenDatesReportPage() {
  return (
    <ReportTableClient
      title="Cylinder Conversion B/W Date"
      description="Cylinder conversions between the selected date range."
      endpoint="/api/reports/cylinder-conversion-between-dates"
      dataKey="rows"
      showItemFilter
      columns={[
        { key: "conversionNo", label: "Conversion No" },
        { key: "referenceNo", label: "Ref No" },
        { key: "transactionDate", label: "Date" },
        { key: "fromItemCode", label: "From Item Code" },
        { key: "fromItemName", label: "From Item Name" },
        { key: "fromState", label: "From State" },
        { key: "fromQty", label: "From Qty" },
        { key: "toItemCode", label: "To Item Code" },
        { key: "toItemName", label: "To Item Name" },
        { key: "toState", label: "To State" },
        { key: "toQty", label: "To Qty" },
        { key: "remarks", label: "Remarks" },
      ]}
    />
  );
}
