import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

const reports = [
  { title: "Sale B/W Date", href: "/reports/sale-between-dates", description: "Pending parity report for sale transactions between dates." },
  { title: "Cylinder Conversion B/W Date", href: "/reports/cylinder-conversion-between-dates", description: "Pending parity report for cylinder conversion history." },
  { title: "One Customer Sale History", href: "/reports/one-customer-sale-history", description: "Pending single-customer sale history report." },
  { title: "Stock Report", href: "/reports/stock-summary", description: "Filled and empty cylinder movement by item." },
  { title: "Cash Book", href: "/reports/cash-book", description: "Cash and bank movement from voucher lines." },
  { title: "Vendor Wise Receiving Report", href: "/reports/vendor-wise-receiving", description: "Pending vendor receiving report." },
  { title: "Chart Of Account", href: "/reports/chart-of-account", description: "Account balances by chart code for the selected period." },
  { title: "Group Summary", href: "/reports/group-summary", description: "Control group roll-up of debits, credits, and balances." },
  { title: "General Ledger", href: "/reports/general-ledger", description: "Pending arbitrary account ledger report." },
  { title: "Customer Ledger", href: "/reports/customer-ledger", description: "Customer debit, credit, and running balance from vouchers." },
  { title: "Sale Return Report", href: "/reports/sale-return", description: "Pending sale return report." },
  { title: "Purchase Return Report", href: "/reports/purchase-return", description: "Pending purchase return report." },
  { title: "Customer Stock Ledger", href: "/reports/customer-stock-ledger", description: "Pending customer cylinder stock ledger report." },
  { title: "Daily Activity Report", href: "/reports/daily-activity", description: "Sectional sales, purchases, returns, vouchers, and stock summary for a date range." },
  { title: "Access Cylinders", href: "/reports/customer-cylinder-balances", description: "Outstanding empty cylinders by customer and item." },
  { title: "Salewise Profit", href: "/reports/salewise-profit", description: "Pending sale-wise profit report." },
  { title: "Profit/Loss Report", href: "/reports/profit-loss", description: "Revenue, expenses, and net profit or loss." },
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
