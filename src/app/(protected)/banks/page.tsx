import { MasterDataManager } from "@/components/MasterDataManager";

export default function BanksPage() {
  return <MasterDataManager title="Banks" description="Bank accounts used for bank receipt and bank payment vouchers." endpoint="/api/banks" dataKey="banks" fields={[
    { name: "name", label: "Bank Name", type: "text", required: true },
    { name: "status", label: "Status", type: "text", required: true, options: ["ACTIVE", "INACTIVE"] },
  ]} columns={[{ key: "name", label: "Bank" }, { key: "status", label: "Status" }]} />;
}
