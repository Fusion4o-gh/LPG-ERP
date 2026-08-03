"use client";

import { ReportTableClient } from "../ReportTableClient";

export default function VehicleBowserReportPage() {
  return (
    <ReportTableClient title="Transport & Bowser Wise Report" description="Vehicle trips, transported quantity, capacity, transporter, and sales amount." endpoint="/api/reports/vehicle-bowser" dataKey="rows" showBulkProductFilter showCustomerFilter showVehicleFilter showTransporterFilter columns={[
      { key: "vehicle", label: "Vehicle", render: (row) => (row.vehicle as { registrationNo?: string })?.registrationNo ?? "" },
      { key: "transporter", label: "Transporter", render: (row) => (row.transporter as { name?: string })?.name ?? "" },
      { key: "vehicle", label: "Capacity", render: (row) => `${(row.vehicle as { bowserCapacity?: string })?.bowserCapacity ?? ""} ${(row.vehicle as { capacityUnit?: string })?.capacityUnit ?? ""}` },
      { key: "trips", label: "Trips" },
      { key: "quantity", label: "Quantity" },
      { key: "amount", label: "Amount" },
    ]} />
  );
}
