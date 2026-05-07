import { MasterDataManager } from "@/components/MasterDataManager";

export default function ItemsPage() {
  return <MasterDataManager title="Items" description="LPG cylinder item list used by stock ledger and cylinder balances." endpoint="/api/items" dataKey="items" fields={[
    { name: "code", label: "Code", type: "text", required: true },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "cylinderWeightKg", label: "Weight KG", type: "number", min: 0 },
    { name: "defaultSecurity", label: "Default Security", type: "number", min: 0 },
    { name: "status", label: "Status", type: "text", required: true, options: ["ACTIVE", "INACTIVE"] },
  ]} columns={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "cylinderWeightKg", label: "Weight KG" }, { key: "defaultSecurity", label: "Security" }, { key: "status", label: "Status" }]} />;
}
