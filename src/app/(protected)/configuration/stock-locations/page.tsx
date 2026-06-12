import { MasterDataManager } from "@/components/MasterDataManager";

export default function StockLocationsPage() {
  return (
    <MasterDataManager
      title="Stock Locations"
      description="Maintain bulk stock locations (plant, import terminal, in-transit, warehouse)."
      endpoint="/api/configuration/stock-locations"
      dataKey="stockLocations"
      fields={[
        { name: "code", label: "Code", type: "text", required: true },
        { name: "name", label: "Location Name", type: "text", required: true },
        { name: "type", label: "Type", type: "select", required: true, options: ["PLANT", "IMPORT_TERMINAL", "IN_TRANSIT", "WAREHOUSE"] },
        {
          name: "plantId",
          label: "Plant",
          type: "select",
          optionSource: { endpoint: "/api/configuration/plants", dataKey: "plants" },
        },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "type", label: "Type" },
        { key: "plantName", label: "Plant" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
