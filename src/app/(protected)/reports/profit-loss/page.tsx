import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function ProfitLossReportPage() {
  return (
    <ReportTableClient
      title="Profit & Loss"
      description="Revenue, expenses, and net profit or loss from posted voucher lines."
      endpoint="/api/reports/profit-loss"
      dataKey="rows"
      columns={[
        { key: "accountType", label: "Category" },
        { key: "accountCode", label: "Account Code" },
        { key: "accountName", label: "Account Name" },
        { key: "debit", label: "Debit", render: (row) => money(row.debit) },
        { key: "credit", label: "Credit", render: (row) => money(row.credit) },
        { key: "amount", label: "Amount", render: (row) => money(row.amount) },
      ]}
    />
  );
}
