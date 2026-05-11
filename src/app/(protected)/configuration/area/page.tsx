import { MasterDataManager } from "@/components/MasterDataManager";

export default function AreaPage() {
  return (
    <MasterDataManager
      title="Area"
      description="Maintain area records and link each area to a city."
      endpoint="/api/configuration/area"
      dataKey="areas"
      fields={[
        { name: "cityId", label: "City", type: "select", required: true, optionSource: { endpoint: "/api/configuration/cities", dataKey: "cities" } },
        { name: "name", label: "Area Name", type: "text", required: true },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "cityName", label: "City" },
        { key: "name", label: "Area Name" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
