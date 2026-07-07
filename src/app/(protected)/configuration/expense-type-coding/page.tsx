import { MasterDataManager } from "@/components/MasterDataManager";

export default function ExpenseTypeCodingPage() {
  return (
    <MasterDataManager
      title="Expense Type Coding"
      description="Maintain expense chart accounts used as expense types. Opening balance posts an opening voucher on create."
      endpoint="/api/configuration/expense-type-coding"
      dataKey="expenseTypes"
      fields={[
        { name: "code", label: "Account Code", type: "text", required: true },
        { name: "name", label: "Expense Type Name", type: "text", required: true },
        { name: "parentId", label: "Parent Expense Account", type: "select", optionSource: { endpoint: "/api/configuration/expense-type-coding", dataKey: "expenseParents", labelKey: "name" } },
        { name: "openingBalance", label: "Opening Balance", type: "number", min: 0 },
        { name: "openingBalanceType", label: "Opening Type", type: "select", options: ["DEBIT", "CREDIT"] },
        { name: "openingDate", label: "Opening Date", type: "date" },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Account Code" },
        { key: "name", label: "Expense Type Name" },
        { key: "parentName", label: "Parent Account" },
        { key: "openingAmount", label: "Opening" },
        { key: "openingBalanceType", label: "Opening Type" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
