import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const reports = [
  { title: "Stock Summary", href: "/reports/stock-summary", description: "Filled and empty cylinder movement by item." },
  { title: "Customer Cylinder Balance", href: "/reports/customer-cylinder-balances", description: "Outstanding empty cylinders by customer and item." },
  { title: "Daily Activity", href: "/reports/daily-activity", description: "Sales, purchases, returns, vouchers, and stock movement counts." },
  { title: "Customer Ledger", href: "/reports/customer-ledger", description: "Customer debit, credit, and running balance from vouchers." },
  { title: "Vendor Ledger", href: "/reports/vendor-ledger", description: "Vendor debit, credit, and running balance from vouchers." },
  { title: "Cash Book", href: "/reports/cash-book", description: "Cash and bank movement from voucher lines." },
  { title: "Trial Balance", href: "/reports/trial-balance", description: "Debit, credit, and net balances by account." },
  { title: "Profit & Loss", href: "/reports/profit-loss", description: "Revenue, expenses, and net profit or loss." },
  { title: "Balance Sheet", href: "/reports/balance-sheet", description: "Assets, liabilities, equity, and balance check." },
];

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Operational Reports" description="Service-backed LPG ERP reports. Print and export come later." />
      <div className="grid gap-4 md:grid-cols-3">
        {reports.map((report) => (
          <Link key={report.href} href={report.href} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-400">
            <div className="font-semibold text-slate-950">{report.title}</div>
            <div className="mt-2 text-sm text-slate-600">{report.description}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
