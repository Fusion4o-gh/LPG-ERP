"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccess, canAny } from "@/lib/permissions";
import type { AppShellContext } from "@/server/auth/app-shell-context";
import { LogoutButton } from "./LogoutButton";

const groups = [
  { title: "Dashboard", links: [{ label: "Dashboard", href: "/dashboard", module: "dashboard" }] },
  {
    title: "Configuration",
    links: [
      { label: "Company Information", href: "/configuration/company-information", module: "company" },
      { label: "User Management", href: "/configuration/user-management", module: "rbac", action: "MANAGE_RBAC" },
      { label: "Change Password", href: "/configuration/change-password", module: "dashboard" },
      { label: "Cities", href: "/configuration/cities", module: "customers" },
      { label: "Area", href: "/configuration/area", module: "customers" },
      { label: "Brand Coding", href: "/configuration/brand-coding", module: "items" },
      { label: "Category Coding", href: "/configuration/category-coding", module: "items" },
      { label: "Item Coding", href: "/masters/items", module: "items" },
      { label: "Customer Coding", href: "/masters/customers", module: "customers" },
      { label: "Vendor Coding", href: "/masters/vendors", module: "vendors" },
      { label: "Bank Coding", href: "/configuration/bank-coding", module: "banks" },
      { label: "Shop Opening Balance", href: "/configuration/shop-opening-balance", module: "stock-ledger" },
      { label: "Cash Opening", href: "/configuration/cash-opening", module: "journal-vouchers" },
      { label: "Day Closing", href: "/operations/day-closing", module: "day-closing" },
      { label: "Customer Opening Balance", href: "/configuration/customer-opening-balance", module: "customer-ledger" },
      { label: "Vendor Opening Balance", href: "/configuration/vendor-opening-balance", module: "vendors" },
      { label: "Expense Type Coding", href: "/configuration/expense-type-coding", module: "chart-of-accounts" },
    ],
  },
  {
    title: "Sale / Purchase",
    links: [
      { label: "Purchase Filled Cylinder", href: "/operations/purchase-filled-cylinder", module: "purchase-filled-cylinders" },
      { label: "Purchase Empty Cylinder", href: "/sale-purchase/purchase-empty-cylinder", module: "purchase-filled-cylinders" },
      { label: "Purchase Other", href: "/sale-purchase/purchase-other", module: "purchase-filled-cylinders" },
      { label: "Complete Day Sale", href: "/operations/complete-day-sale", module: "sale-lpg" },
      { label: "Sale LPG", href: "/operations/sale-lpg", module: "sale-lpg" },
      { label: "Decanting Sale", href: "/sale-purchase/decanting-sale", module: "decanting-sales" },
      { label: "Cylinder Conversion", href: "/sale-purchase/cylinder-conversion", module: "cylinder-conversions" },
      { label: "Empty Sale", href: "/sale-purchase/empty-sale", module: "empty-sales" },
    ],
  },
  {
    title: "Returns",
    links: [
      { label: "Cylinder Return", href: "/operations/cylinder-return", module: "cylinder-returns" },
      { label: "Purchase Return Cylinder", href: "/returns/purchase-return-cylinder", module: "purchase-filled-cylinders" },
      { label: "Purchase Return Other", href: "/returns/purchase-return-other", module: "purchase-filled-cylinders" },
    ],
  },
  {
    title: "Payment / Receipt",
    links: [
      { label: "Cash Payment", href: "/payments/cash-payment", module: "cash-payments" },
      { label: "Cash Receipt", href: "/payments/cash-receipt", module: "cash-receipts" },
      { label: "Security Receipt", href: "/payments/security-receipt", module: "cash-receipts" },
      { label: "Chart of Account", href: "/accounting/chart-of-accounts", module: "chart-of-accounts" },
      { label: "Journal Vouchers", href: "/payments/journal-vouchers", module: "journal-vouchers" },
      { label: "Bank Payments / Receipt", href: "/payments/bank-payments-receipts", module: "bank-payments" },
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
      { label: "Bank Book", href: "/reports/bank-book", module: "reports" },
      { label: "Vendor Wise Receiving", href: "/reports/vendor-wise-receiving", module: "reports" },
      { label: "Chart Of Account", href: "/reports/chart-of-account", module: "reports" },
      { label: "Group Summary", href: "/reports/group-summary", module: "reports" },
      { label: "General Ledger", href: "/reports/general-ledger", module: "reports" },
      { label: "Customer Ledger", href: "/reports/customer-ledger", module: "reports" },
      { label: "Sale Return Report", href: "/reports/sale-return", module: "reports" },
      { label: "Purchase Return Report", href: "/reports/purchase-return", module: "reports" },
      { label: "Customer Stock Ledger", href: "/reports/customer-stock-ledger", module: "reports" },
      { label: "Daily Activity Report", href: "/reports/daily-activity", module: "reports" },
      { label: "Access Cylinders", href: "/reports/customer-cylinder-balances", module: "reports" },
      { label: "Salewise Profit", href: "/reports/salewise-profit", module: "reports" },
      { label: "Profit / Loss Report", href: "/reports/profit-loss", module: "reports" },
    ],
  },
  {
    title: "Database",
    links: [{ label: "Database Backup", href: "/database-backup", module: "rbac", action: "MANAGE_RBAC" }],
  },
];

export function Sidebar({
  permissions,
  shell,
  onClose,
}: {
  permissions: string[];
  shell: AppShellContext;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  const visibleGroups = groups.filter((group) =>
    canAny(permissions, group.links.map((link) => ({ module: link.module, action: link.action })))
  );

  return (
    <aside
      data-print-hidden
      className="flex flex-col md:min-h-screen md:w-72 shrink-0"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      {/* Logo area */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <img src="/fusion4o-logo.png" alt="Fusion4o" className="h-9 w-9 object-contain" />
          <div className="flex-1 min-w-0">
            <div className="truncate text-[15px] font-bold text-white leading-tight tracking-tight">{shell.companyName}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--sidebar-text)" }}>
              LPG ERP · FY {shell.financialYearLabel}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden rounded-md p-1 text-slate-400 hover:text-white transition-colors"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleGroups.map((group) => {
          const visibleLinks = group.links.filter((link) =>
            canAccess(permissions, link.module, link.action ?? "VIEW")
          );
          if (visibleLinks.length === 0) return null;

          return (
            <div key={group.title} className="mb-3">
              <div className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                {group.title}
              </div>
              <div className="space-y-0.5">
                {visibleLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center rounded-lg px-3 py-2 text-sm leading-snug transition-all ${
                        isActive
                          ? "font-semibold text-white shadow-sm sidebar-link-active"
                          : "text-slate-400 hover:text-slate-100 sidebar-link-hover"
                      }`}
                      style={isActive ? { background: "var(--sidebar-active-bg)" } : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-4 space-y-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3 px-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: "var(--fusion-gradient)" }}
            aria-hidden
          >
            {shell.userName
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white leading-tight">{shell.userName}</p>
            <p className="truncate text-[11px]" style={{ color: "var(--sidebar-text)" }}>
              {shell.loginId}
            </p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
