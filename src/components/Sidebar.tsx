import Link from "next/link";
import { canAccess, canAny } from "@/lib/permissions";
import { LogoutButton } from "./LogoutButton";

const groups = [
  { title: "Dashboard", links: [{ label: "Dashboard", href: "/dashboard", module: "dashboard" }] },
  {
    title: "Master Data",
    links: [
      { label: "Customers", href: "/masters/customers", module: "customers" },
      { label: "Vendors", href: "/masters/vendors", module: "vendors" },
      { label: "Items", href: "/masters/items", module: "items" },
      { label: "Banks", href: "/banks", module: "banks" },
      { label: "Chart of Accounts", href: "/accounting/chart-of-accounts", module: "chart-of-accounts" },
      { label: "Customer Cylinder Balance", href: "/customer-cylinder-balances", module: "customer-ledger" },
    ],
  },
  {
    title: "Operations",
    links: [
      { label: "Purchase Filled Cylinder", href: "/operations/purchase-filled-cylinder", module: "purchase-filled-cylinders" },
      { label: "Sale LPG", href: "/operations/sale-lpg", module: "sale-lpg" },
      { label: "Complete Day Sale", href: "/operations/complete-day-sale", module: "sale-lpg" },
      { label: "Cylinder Return", href: "/operations/cylinder-return", module: "cylinder-returns" },
      { label: "Day Closing", href: "/operations/day-closing", module: "day-closing" },
      { label: "Reversals", href: "/operations/reversals", module: "journal-vouchers", action: "APPROVE" },
    ],
  },
  {
    title: "Payments",
    links: [
      { label: "Cash Receipt", href: "/payments/cash-receipt", module: "cash-receipts" },
      { label: "Cash Payment", href: "/payments/cash-payment", module: "cash-payments" },
      { label: "Bank Receipt", href: "/payments/bank-receipt", module: "bank-receipts" },
      { label: "Bank Payment", href: "/payments/bank-payment", module: "bank-payments" },
      { label: "Security Receipt", href: "/payments/security-receipt", module: "cash-receipts" },
    ],
  },
  {
    title: "Reports",
    links: [
      { label: "Stock Ledger", href: "/stock-ledger", module: "stock-ledger" },
      { label: "Vouchers", href: "/accounting/vouchers", module: "journal-vouchers" },
      { label: "Audit Log", href: "/audit-log", module: "audit-log" },
      { label: "Operational Reports", href: "/reports", module: "reports" },
    ],
  },
  {
    title: "Settings",
    links: [{ label: "Roles & Permissions", href: "/settings/roles", module: "rbac", action: "MANAGE_RBAC" }],
  },
];

export function Sidebar({ permissions }: { permissions: string[] }) {
  return (
    <aside data-print-hidden className="border-r border-slate-200 bg-white p-4 md:min-h-screen md:w-72">
      <div className="mb-5">
        <div className="text-lg font-semibold text-slate-950">LPG ERP</div>
        <div className="text-xs text-slate-500">Cylinder distribution operations</div>
      </div>
      <nav className="space-y-5">
        {groups.filter((group) => canAny(permissions, group.links.map((link) => ({ module: link.module, action: link.action })))).map((group) => (
          <div key={group.title}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title}</div>
            <div className="space-y-1">
              {group.links.filter((link) => canAccess(permissions, link.module, link.action ?? "VIEW")).map((link) => (
                <Link key={link.href} href={link.href} className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
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
