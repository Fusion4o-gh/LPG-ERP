import { MasterDataManager } from "@/components/MasterDataManager";

export default function CategoryCodingPage() {
  return (
    <MasterDataManager
      title="Category Coding"
      description="Maintain item categories. System-protected categories cannot be renamed or deactivated."
      endpoint="/api/configuration/category-coding"
      dataKey="categories"
      fields={[
        { name: "name", label: "Category Name", type: "text", required: true },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "name", label: "Category Name" },
        { key: "status", label: "Status" },
        { key: "isSystemProtected", label: "Protected" },
      ]}
    />
  );
}
