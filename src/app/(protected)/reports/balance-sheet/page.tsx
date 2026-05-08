"use client";

import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function BalanceSheetReportPage() {
  return (
    <ReportTableClient
      title="Balance Sheet"
      description="Assets, liabilities, equity, and balance check from posted voucher lines."
      endpoint="/api/reports/balance-sheet"
      dataKey="rows"
      showAsOfFilter
      columns={[
        { key: "accountType", label: "Category" },
        { key: "accountCode", label: "Account Code" },
        { key: "accountName", label: "Account Name" },
        { key: "debit", label: "Debit", render: (row) => money(row.debit) },
        { key: "credit", label: "Credit", render: (row) => money(row.credit) },
        { key: "balance", label: "Balance", render: (row) => money(row.balance) },
      ]}
    />
  );
}
