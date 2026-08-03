import { ChartOfAccountsTree } from "@/components/ChartOfAccountsTree";
import { MasterDataManager } from "@/components/MasterDataManager";

export default function ChartOfAccountsPage() {
  return (
    <div className="space-y-8">
      <ChartOfAccountsTree />
      <MasterDataManager
        title="Maintain Accounts"
        description="Add or edit chart accounts. The tree above reflects parent hierarchy after save."
        endpoint="/api/chart-of-accounts"
        dataKey="accounts"
        fields={[
          { name: "code", label: "Code", type: "text", required: true },
          { name: "name", label: "Name", type: "text", required: true },
          { name: "parentId", label: "Parent Account", type: "select", optionSource: { endpoint: "/api/chart-of-accounts", dataKey: "accounts", labelKey: "name" } },
          { name: "address", label: "Address", type: "text" },
          { name: "isSubLedger", label: "Sub-ledger", type: "select", options: ["true", "false"] },
          { name: "debitLimit", label: "Debit Limit", type: "number", min: 0 },
          { name: "creditLimit", label: "Credit Limit", type: "number", min: 0 },
          { name: "openingBalance", label: "Opening Balance (metadata)", type: "number", min: 0 },
          { name: "openingBalanceType", label: "Opening Type", type: "select", options: ["DEBIT", "CREDIT"] },
          { name: "isBalanceSheet", label: "Balance Sheet Account", type: "select", options: ["true", "false"] },
          { name: "phone", label: "Phone", type: "text" },
          { name: "mobile", label: "Mobile", type: "text" },
          { name: "ntn", label: "NTN", type: "text" },
          { name: "strn", label: "STRN", type: "text" },
          { name: "email", label: "Email", type: "text" },
          { name: "contactPerson", label: "Contact Person", type: "text" },
          { name: "accountType", label: "Account Type", type: "text", required: true, options: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] },
          { name: "normalBalance", label: "Normal Balance", type: "text", required: true, options: ["DEBIT", "CREDIT"] },
          { name: "status", label: "Status", type: "text", required: true, options: ["ACTIVE", "INACTIVE"] },
        ]}
        columns={[
          { key: "code", label: "Code" },
          { key: "name", label: "Name" },
          { key: "accountType", label: "Type" },
          { key: "level", label: "Level" },
          { key: "status", label: "Status" },
        ]}
      />
    </div>
  );
}
