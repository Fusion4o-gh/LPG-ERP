import { MasterDataManager } from "@/components/MasterDataManager";

export default function CustomersPage() {
  return <MasterDataManager title="Customers" description="Customer master list for LPG sales, receipts, and cylinder accountability." endpoint="/api/customers" dataKey="customers" fields={[
    { name: "code", label: "Code", type: "text", required: true },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text" },
    { name: "cell", label: "Cell", type: "text" },
    { name: "address", label: "Address", type: "text" },
    { name: "status", label: "Status", type: "text", required: true, options: ["ACTIVE", "INACTIVE"] },
  ]} columns={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "cell", label: "Cell" }, { key: "status", label: "Status" }]} />;
}
