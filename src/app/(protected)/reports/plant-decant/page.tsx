"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function PlantDecantReportPage() {
  return <ReportTableClient title="Plant Decant Report" description="Bulk product movements from source locations into plant destinations with transport traceability." endpoint="/api/reports/plant-decant" dataKey="rows" showBulkProductFilter showLocationFilter columns={[
    { key: "documentNo", label: "Document No" }, { key: "date", label: "Date" }, { key: "plant", label: "Plant", render: (row) => (row.plant as { name?: string })?.name ?? "" }, { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" },
    { key: "sourceLocation", label: "Source", render: (row) => (row.sourceLocation as { name?: string })?.name ?? "" }, { key: "destinationLocation", label: "Destination", render: (row) => (row.destinationLocation as { name?: string })?.name ?? "" }, { key: "vehicle", label: "Vehicle", render: (row) => (row.vehicle as { registrationNo?: string })?.registrationNo ?? "" }, { key: "quantity", label: "Quantity" }, { key: "amount", label: "Amount" },
  ]} />;
}
