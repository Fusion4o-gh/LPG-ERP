import { MasterDataManager } from "@/components/MasterDataManager";

export default function CitiesPage() {
  return (
    <MasterDataManager
      title="Cities"
      description="Maintain active and inactive city master records."
      endpoint="/api/configuration/cities"
      dataKey="cities"
      fields={[
        { name: "name", label: "City Name", type: "text", required: true },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "name", label: "City Name" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
