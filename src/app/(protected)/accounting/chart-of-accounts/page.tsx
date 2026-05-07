import { MasterDataManager } from "@/components/MasterDataManager";

export default function ChartOfAccountsPage() {
  return <MasterDataManager title="Chart of Accounts" description="Account list used by vouchers and financial transactions. Edits are high-risk and require confirmation." endpoint="/api/chart-of-accounts" dataKey="accounts" fields={[
    { name: "code", label: "Code", type: "text", required: true },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "accountType", label: "Account Type", type: "text", required: true, options: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] },
    { name: "normalBalance", label: "Normal Balance", type: "text", required: true, options: ["DEBIT", "CREDIT"] },
    { name: "status", label: "Status", type: "text", required: true, options: ["ACTIVE", "INACTIVE"] },
  ]} columns={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "accountType", label: "Type" }, { key: "normalBalance", label: "Normal Balance" }, { key: "status", label: "Status" }]} />;
}
