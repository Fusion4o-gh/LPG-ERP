"use client";

import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function DebtorsAgeingReportPage() {
  return (
    <ReportTableClient
      title="Debtors Ageing Report"
      description="Customer receivables aged from posted vouchers by contractual credit days."
      endpoint="/api/reports/debtors-ageing"
      dataKey="rows"
      showAsOfFilter
      columns={[
        { key: "code", label: "Customer Code" },
        { key: "name", label: "Customer" },
        { key: "creditDays", label: "Credit Days" },
        { key: "current", label: "Current", render: (row) => money(row.current) },
        { key: "days1To30", label: "1–30", render: (row) => money(row.days1To30) },
        { key: "days31To60", label: "31–60", render: (row) => money(row.days31To60) },
        { key: "days61To90", label: "61–90", render: (row) => money(row.days61To90) },
        { key: "over90", label: "Over 90", render: (row) => money(row.over90) },
        { key: "outstanding", label: "Outstanding", render: (row) => money(row.outstanding) },
        { key: "creditBalance", label: "Credit Balance", render: (row) => money(row.creditBalance) },
      ]}
    />
  );
}
