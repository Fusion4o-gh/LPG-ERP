import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function TrialBalanceReportPage() {
  return (
    <ReportTableClient
      title="Trial Balance"
      description="Account totals from posted voucher lines."
      endpoint="/api/reports/trial-balance"
      dataKey="rows"
      showAccountTypeFilter
      columns={[
        { key: "accountCode", label: "Account Code" },
        { key: "accountName", label: "Account Name" },
        { key: "accountType", label: "Type" },
        { key: "totalDebit", label: "Total Debit", render: (row) => money(row.totalDebit) },
        { key: "totalCredit", label: "Total Credit", render: (row) => money(row.totalCredit) },
        { key: "netDebit", label: "Net Debit", render: (row) => money(row.netDebit) },
        { key: "netCredit", label: "Net Credit", render: (row) => money(row.netCredit) },
      ]}
    />
  );
}
