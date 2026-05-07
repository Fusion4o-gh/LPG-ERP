import { ReportTableClient } from "../ReportTableClient";

export default function DailyActivityReportPage() {
  return (
    <ReportTableClient
      title="Daily Activity Report"
      description="Operational counts from stock ledger and accounting voucher records."
      endpoint="/api/reports/daily-activity"
      dataKey="rows"
      columns={[
        { key: "salesCount", label: "Sales" },
        { key: "purchaseCount", label: "Purchases" },
        { key: "cylinderReturnsCount", label: "Cylinder Returns" },
        { key: "cashVoucherCount", label: "Cash Vouchers" },
        { key: "bankVoucherCount", label: "Bank Vouchers" },
        { key: "stockMovements", label: "Stock Movements" },
      ]}
    />
  );
}
