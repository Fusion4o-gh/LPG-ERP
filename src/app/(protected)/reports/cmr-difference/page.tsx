"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function CmrDifferenceReportPage() {
  return (
    <ReportTableClient
      title="CMR Difference Report"
      description="Compare loaded import quantities with CMR quantities recorded on arrival."
      endpoint="/api/reports/cmr-difference"
      dataKey="rows"
      showBulkProductFilter
      showImportTypeFilter
      columns={[
        { key: "loadingNo", label: "Loading No" },
        { key: "loadingDate", label: "Date" },
        { key: "contractNo", label: "Contract No" },
        { key: "importType", label: "Import Type" },
        { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" },
        { key: "quantityLoaded", label: "Loaded Qty" },
        { key: "cmrQuantity", label: "CMR Qty" },
        { key: "difference", label: "Difference" },
        { key: "shipmentStatus", label: "Status" },
      ]}
    />
  );
}
