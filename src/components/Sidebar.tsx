import Link from "next/link";
import { canAccess, canAny } from "@/lib/permissions";
import { LogoutButton } from "./LogoutButton";

const groups = [
  { title: "Dashboard", links: [{ label: "Dashboard", href: "/dashboard", module: "dashboard" }] },
  {
    title: "Configuration",
    links: [
      { label: "Company Information", href: "/configuration/company-information", module: "company" },
      { label: "User Management", href: "/configuration/user-management", module: "rbac", action: "MANAGE_RBAC" },
      { label: "Cities", href: "/configuration/cities", module: "customers" },
      { label: "Area", href: "/configuration/area", module: "customers" },
      { label: "Brand Coding", href: "/configuration/brand-coding", module: "items" },
      { label: "Category Coding", href: "/configuration/category-coding", module: "items" },
      { label: "Item Coding", href: "/masters/items", module: "items" },
      { label: "Customer Coding", href: "/masters/customers", module: "customers" },
      { label: "Vendor Coding", href: "/masters/vendors", module: "vendors" },
      { label: "Shop Opening Balance", href: "/configuration/shop-opening-balance", module: "stock-ledger" },
      { label: "Cash Opening", href: "/configuration/cash-opening", module: "journal-vouchers" },
      { label: "Day Closing", href: "/operations/day-closing", module: "day-closing" },
      { label: "CustomerOpeningBalance", href: "/configuration/customer-opening-balance", module: "customer-ledger" },
      { label: "Expense Type Coding", href: "/configuration/expense-type-coding", module: "chart-of-accounts" },
    ],
  },
  {
    title: "Sale/Purchase",
    links: [
      { label: "Purchase Filled Cylinder", href: "/operations/purchase-filled-cylinder", module: "purchase-filled-cylinders" },
      { label: "Purchase Empty Cylinder", href: "/sale-purchase/purchase-empty-cylinder", module: "purchase-filled-cylinders" },
      { label: "Purchase Other", href: "/sale-purchase/purchase-other", module: "purchase-filled-cylinders" },
      { label: "Sale LPG", href: "/operations/sale-lpg", module: "sale-lpg" },
      { label: "Decanting Sale", href: "/sale-purchase/decanting-sale", module: "sale-lpg" },
      { label: "Cylinder Conversion", href: "/sale-purchase/cylinder-conversion", module: "sale-lpg" },
      { label: "Empty Sale", href: "/sale-purchase/empty-sale", module: "sale-lpg" },
    ],
  },
  {
    title: "Return",
    links: [
      { label: "Cylinder Return", href: "/operations/cylinder-return", module: "cylinder-returns" },
      { label: "Purchase Return Cylinder", href: "/returns/purchase-return-cylinder", module: "purchase-filled-cylinders" },
      { label: "Purchase Return Other", href: "/returns/purchase-return-other", module: "purchase-filled-cylinders" },
    ],
  },
  {
    title: "Payment/Receipt",
    links: [
      { label: "Cash Payment", href: "/payments/cash-payment", module: "cash-payments" },
      { label: "Cash Receipt", href: "/payments/cash-receipt", module: "cash-receipts" },
      { label: "Security Receipt", href: "/payments/security-receipt", module: "cash-receipts" },
      { label: "Chart of Account", href: "/accounting/chart-of-accounts", module: "chart-of-accounts" },
      { label: "Journal Vouchers", href: "/accounting/vouchers", module: "journal-vouchers" },
      { label: "Bank Payments/Receipt", href: "/payments/bank-payments-receipts", module: "bank-payments" },
    ],
  },
  {
    title: "Reports",
    links: [
      { label: "Sale B/W Date", href: "/reports/sale-between-dates", module: "reports" },
      { label: "Cylinder Conversion B/W Date", href: "/reports/cylinder-conversion-between-dates", module: "reports" },
      { label: "One Customer Sale History", href: "/reports/one-customer-sale-history", module: "reports" },
      { label: "Stock Report", href: "/reports/stock-summary", module: "reports" },
      { label: "Cash Book", href: "/reports/cash-book", module: "reports" },
      { label: "Vendor Wise Receiving Report", href: "/reports/vendor-wise-receiving", module: "reports" },
      { label: "General Ledger", href: "/reports/general-ledger", module: "reports" },
      { label: "Customer Ledger", href: "/reports/customer-ledger", module: "reports" },
      { label: "Sale Return Report", href: "/reports/sale-return", module: "reports" },
      { label: "Purchase Return Report", href: "/reports/purchase-return", module: "reports" },
      { label: "Customer Stock Ledger", href: "/reports/customer-stock-ledger", module: "reports" },
      { label: "Daily Activity Report", href: "/reports/daily-activity", module: "reports" },
      { label: "Access Cylinders", href: "/reports/customer-cylinder-balances", module: "reports" },
      { label: "Salewise Profit", href: "/reports/salewise-profit", module: "reports" },
      { label: "Profit/Loss Report", href: "/reports/profit-loss", module: "reports" },
    ],
  },
  {
    title: "Database Backup",
    links: [{ label: "Database Backup", href: "/database-backup", module: "rbac", action: "MANAGE_RBAC" }],
  },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside data-print-hidden className="border-r border-blue-900/20 bg-blue-950 p-4 text-white md:min-h-screen md:w-80">
      <div className="mb-5 flex items-center gap-3 border-b border-white/10 pb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-white/30">
          <img src="/fusion4o-logo.png" alt="Fusion4o" className="h-8 w-8 object-contain" />
        </div>
        <div>
          <div className="text-lg font-semibold text-white">LPG ERP</div>
          <div className="text-xs text-blue-100">Powered by Fusion4o</div>
        </div>
      </div>
      <nav className="space-y-5">
        {groups.filter((group) => canAny(permissions, group.links.map((link) => ({ module: link.module, action: link.action })))).map((group) => (
          <div key={group.title}>
            <div className="mb-2 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-blue-50">{group.title}</div>
            <div className="space-y-1">
              {group.links.filter((link) => canAccess(permissions, link.module, link.action ?? "VIEW")).map((link) => (
                <Link key={link.href} href={link.href} className="block rounded-md px-3 py-2 text-sm text-blue-50 hover:bg-white hover:text-blue-950">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <LogoutButton />
    </aside>
  );
}
