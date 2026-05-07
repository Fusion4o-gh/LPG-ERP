import { MasterDataManager } from "@/components/MasterDataManager";

export default function VendorsPage() {
  return <MasterDataManager title="Vendors" description="Vendor master list for filled-cylinder purchases and payable vouchers." endpoint="/api/vendors" dataKey="vendors" fields={[
    { name: "code", label: "Code", type: "text", required: true },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "phone", label: "Phone", type: "text" },
    { name: "cell", label: "Cell", type: "text" },
    { name: "address", label: "Address", type: "text" },
    { name: "status", label: "Status", type: "text", required: true, options: ["ACTIVE", "INACTIVE"] },
  ]} columns={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "cell", label: "Cell" }, { key: "status", label: "Status" }]} />;
}
