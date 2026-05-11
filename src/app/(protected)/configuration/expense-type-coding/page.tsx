import { MasterDataManager } from "@/components/MasterDataManager";

export default function ExpenseTypeCodingPage() {
  return (
    <MasterDataManager
      title="Expense Type Coding"
      description="Maintain expense chart accounts used as expense types. Detailed transaction mapping is handled by accounting services."
      endpoint="/api/configuration/expense-type-coding"
      dataKey="expenseTypes"
      fields={[
        { name: "code", label: "Account Code", type: "text", required: true },
        { name: "name", label: "Expense Type Name", type: "text", required: true },
        { name: "parentId", label: "Parent Expense Account", type: "select", optionSource: { endpoint: "/api/configuration/expense-type-coding", dataKey: "expenseParents", labelKey: "name" } },
        { name: "status", label: "Status", type: "select", required: true, options: ["ACTIVE", "INACTIVE"] },
      ]}
      columns={[
        { key: "code", label: "Account Code" },
        { key: "name", label: "Expense Type Name" },
        { key: "parentName", label: "Parent Account" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
