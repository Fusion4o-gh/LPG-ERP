import { MasterDataManager } from "@/components/MasterDataManager";

export default function PlantsPage() {
  return (
    <MasterDataManager
      title="Plants"
      description="Maintain LPG plants used for filling, bulk sale, transfer, and stock holding."
      endpoint="/api/configuration/plants"
      dataKey="plants"
      fields={[
        { name: "code", label: "Code", type: "text", required: true },
        { name: "name", label: "Plant Name", type: "text", required: true },
        {
          name: "cityId",
          label: "City",
          type: "select",
          optionSource: { endpoint: "/api/configuration/cities", dataKey: "cities" },
        },
        { name: "location", label: "Location", type: "text" },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "cityName", label: "City" },
        { key: "location", label: "Location" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
