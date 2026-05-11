import { MasterDataManager } from "@/components/MasterDataManager";

export default function BrandCodingPage() {
  return (
    <MasterDataManager
      title="Brand Coding"
      description="Maintain active and inactive item brands."
      endpoint="/api/configuration/brand-coding"
      dataKey="brands"
      fields={[
        { name: "name", label: "Brand Name", type: "text", required: true },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "name", label: "Brand Name" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
