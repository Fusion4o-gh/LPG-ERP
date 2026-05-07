import { ReportTableClient } from "../ReportTableClient";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function CustomerLedgerReportPage() {
  return (
    <ReportTableClient
      title="Customer Ledger Report"
      description="Customer account movement from posted voucher lines."
      endpoint="/api/reports/customer-ledger"
      dataKey="rows"
      showCustomerFilter
      columns={[
        { key: "transactionDate", label: "Date", render: (row) => (row.transactionDate ? String(row.transactionDate).slice(0, 10) : "") },
        { key: "voucherNo", label: "Voucher / Opening" },
        { key: "sourceId", label: "Source Document" },
        { key: "description", label: "Narration" },
        { key: "debit", label: "Debit", render: (row) => money(row.debit) },
        { key: "credit", label: "Credit", render: (row) => money(row.credit) },
        { key: "runningBalance", label: "Running Balance", render: (row) => money(row.runningBalance) },
      ]}
    />
  );
}
