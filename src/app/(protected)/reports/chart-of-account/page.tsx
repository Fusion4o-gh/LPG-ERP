"use client";

import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function ChartOfAccountReportPage() {
  return (
    <ReportTableClient
      title="Chart Of Account Report"
      description="Account-level period debits, credits, and balances from posted vouchers."
      endpoint="/api/reports/chart-of-account"
      dataKey="rows"
      columns={[
        { key: "accountCode", label: "Account Code" },
        { key: "accountName", label: "Account Name" },
        { key: "level", label: "Level" },
        { key: "accountType", label: "Type" },
        { key: "periodDebit", label: "Period Debit", render: (row) => money(row.periodDebit) },
        { key: "periodCredit", label: "Period Credit", render: (row) => money(row.periodCredit) },
        { key: "balance", label: "Balance", render: (row) => money(row.balance) },
      ]}
    />
  );
}
