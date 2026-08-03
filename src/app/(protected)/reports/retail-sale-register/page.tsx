"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function RetailSaleRegisterReportPage() {
  return (
    <ReportTableClient title="Retail Sale Register" description="Delivered and filling sales with customer, product, vehicle, weight, rate, and amount details." endpoint="/api/reports/retail-sale-register" dataKey="rows" showBulkProductFilter showCustomerFilter showVehicleFilter showTransporterFilter columns={[
      { key: "documentNo", label: "Document No" },
      { key: "date", label: "Date" },
      { key: "saleType", label: "Sale Type" },
      { key: "customer", label: "Customer", render: (row) => (row.customer as { name?: string })?.name ?? "" },
      { key: "product", label: "Product", render: (row) => (row.product as { name?: string })?.name ?? "" },
      { key: "vehicle", label: "Vehicle", render: (row) => (row.vehicle as { registrationNo?: string })?.registrationNo ?? "" },
      { key: "transporter", label: "Transporter", render: (row) => (row.transporter as { name?: string })?.name ?? "" },
      { key: "quantity", label: "Quantity" },
      { key: "deliveryWeight", label: "Delivery Weight" },
      { key: "loadWeight", label: "Load Weight" },
      { key: "amount", label: "Amount" },
    ]} />
  );
}
