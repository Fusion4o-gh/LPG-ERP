"use client";

import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function UnbalancedVouchersReportPage() {
  return (
    <ReportTableClient
      title="Unbalance Voucher"
      description="Posted vouchers whose debit and credit totals do not reconcile. Use this before closing a business day."
      endpoint="/api/reports/unbalanced-vouchers"
      dataKey="rows"
      columns={[
        { key: "voucherNo", label: "Voucher No" },
        { key: "voucherDate", label: "Date" },
        { key: "voucherType", label: "Type" },
        { key: "totalDebit", label: "Debit", render: (row) => money(row.totalDebit) },
        { key: "totalCredit", label: "Credit", render: (row) => money(row.totalCredit) },
        { key: "difference", label: "Difference", render: (row) => money(row.difference) },
        { key: "sourceType", label: "Source" },
        { key: "sourceId", label: "Source ID" },
        { key: "narration", label: "Narration" },
      ]}
    />
  );
}
