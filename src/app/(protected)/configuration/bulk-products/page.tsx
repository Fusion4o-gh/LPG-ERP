import { MasterDataManager } from "@/components/MasterDataManager";

export default function BulkProductsPage() {
  return (
    <MasterDataManager
      title="Bulk Products"
      description="Maintain bulk LPG products and their default unit of measure (MT / KG / Litre)."
      endpoint="/api/configuration/bulk-products"
      dataKey="bulkProducts"
      fields={[
        { name: "code", label: "Code", type: "text", required: true },
        { name: "name", label: "Product Name", type: "text", required: true },
        { name: "unit", label: "Unit", type: "select", required: true, options: ["MT", "KG", "LITRE"] },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "unit", label: "Unit" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
