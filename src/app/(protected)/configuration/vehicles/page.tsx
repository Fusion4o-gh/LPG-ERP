import { MasterDataManager } from "@/components/MasterDataManager";

export default function VehiclesPage() {
  return (
    <MasterDataManager
      title="Vehicles / Bowsers"
      description="Maintain bowsers and vehicles, their capacity, transporter, and assigned driver."
      endpoint="/api/configuration/vehicles"
      dataKey="vehicles"
      fields={[
        { name: "registrationNo", label: "Registration No", type: "text", required: true },
        { name: "bowserCapacity", label: "Bowser Capacity", type: "number" },
        { name: "capacityUnit", label: "Capacity Unit", type: "select", options: ["MT", "KG", "LITRE"] },
        {
          name: "transporterId",
          label: "Transporter",
          type: "select",
          optionSource: { endpoint: "/api/configuration/transporters", dataKey: "transporters" },
        },
        {
          name: "driverId",
          label: "Driver",
          type: "select",
          optionSource: { endpoint: "/api/configuration/drivers", dataKey: "drivers" },
        },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE", "IN_TRANSIT", "MAINTENANCE"] },
      ]}
      columns={[
        { key: "registrationNo", label: "Registration" },
        { key: "bowserCapacity", label: "Capacity" },
        { key: "capacityUnit", label: "Unit" },
        { key: "transporterName", label: "Transporter" },
        { key: "driverName", label: "Driver" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
