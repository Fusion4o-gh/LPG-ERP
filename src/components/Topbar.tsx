"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppShellContext } from "@/server/auth/app-shell-context";
import { FinancialYearSwitcher } from "./FinancialYearSwitcher";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  configuration: "Configuration",
  operations: "Operations",
  "sale-purchase": "Sale / Purchase",
  returns: "Returns",
  payments: "Payments",
  reports: "Reports",
  masters: "Masters",
  accounting: "Accounting",
  settings: "Settings",
  "company-information": "Company Information",
  "user-management": "User Management",
  cities: "Cities",
  area: "Area",
  "brand-coding": "Brand Coding",
  "bank-coding": "Bank Coding",
  "category-coding": "Category Coding",
  items: "Item Coding",
  customers: "Customer Coding",
  vendors: "Vendor Coding",
  "shop-opening-balance": "Shop Opening Balance",
  "cash-opening": "Cash Opening",
  "day-closing": "Day Closing",
  "customer-opening-balance": "Customer Opening Balance",
  "vendor-opening-balance": "Vendor Opening Balance",
  "expense-type-coding": "Expense Type Coding",
  "purchase-filled-cylinder": "Purchase Filled Cylinder",
  "purchase-empty-cylinder": "Purchase Empty Cylinder",
  "purchase-other": "Purchase Other",
  "complete-day-sale": "Complete Day Sale",
  "sale-lpg": "Sale LPG",
  "decanting-sale": "Decanting Sale",
  "cylinder-conversion": "Cylinder Conversion",
  "empty-sale": "Empty Sale",
  "cylinder-return": "Cylinder Return",
  "purchase-return-cylinder": "Purchase Return Cylinder",
  "purchase-return-other": "Purchase Return Other",
  "cash-payment": "Cash Payment",
  "cash-receipt": "Cash Receipt",
  "security-receipt": "Security Receipt",
  "chart-of-accounts": "Chart of Accounts",
  "journal-vouchers": "Journal Vouchers",
  "bank-payments-receipts": "Bank Payments / Receipt",
  "bank-payment": "Bank Payment",
  "bank-receipt": "Bank Receipt",
  "sale-between-dates": "Sale B/W Date",
  "cylinder-conversion-between-dates": "Cylinder Conversion B/W Date",
  "one-customer-sale-history": "One Customer Sale History",
  "stock-summary": "Stock Report",
  "cash-book": "Cash Book",
  "bank-book": "Bank Book",
  "vendor-wise-receiving": "Vendor Wise Receiving",
  "general-ledger": "General Ledger",
  "customer-ledger": "Customer Ledger",
  "sale-return": "Sale Return Report",
  "purchase-return": "Purchase Return Report",
  "customer-stock-ledger": "Customer Stock Ledger",
  "daily-activity": "Daily Activity Report",
  "customer-cylinder-balances": "Access Cylinders",
  "salewise-profit": "Salewise Profit",
  "profit-loss": "Profit / Loss Report",
  "trial-balance": "Trial Balance",
  "balance-sheet": "Balance Sheet",
  "database-backup": "Database Backup",
  "audit-log": "Audit Log",
  reversals: "Transaction Reversals",
  roles: "Roles & Permissions",
  vouchers: "Vouchers",
  banks: "Banks",
  "stock-ledger": "Stock Ledger",
  print: "Print",
};

function labelForSegment(segment: string) {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function breadcrumbsFromPath(pathname: string) {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard", href: "/dashboard" }];
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: "Dashboard", href: "/dashboard" }];

  let path = "";
  let skipNext = false;
  for (const segment of segments) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (segment === "print") {
      skipNext = true;
      continue;
    }
    if (/^c[a-z0-9]{20,}$/i.test(segment) || /^\d+$/.test(segment)) {
      continue;
    }
    path += `/${segment}`;
    crumbs.push({ label: labelForSegment(segment), href: path });
  }

  return crumbs;
}

function formatToday() {
  return new Date().toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function Topbar({ shell }: { shell: AppShellContext }) {
  const pathname = usePathname();
  const crumbs = breadcrumbsFromPath(pathname);

  return (
    <header
      data-print-hidden
      className="app-topbar sticky top-0 z-20 hidden h-12 shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-md md:flex"
    >
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span className="text-slate-300">/</span> : null}
              {isLast ? (
                <span className="truncate font-semibold text-slate-900">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="truncate hover:text-blue-700 transition-colors">
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <div className="relative hidden lg:block">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
            />
          </svg>
          <input
            type="search"
            disabled
            placeholder="Search customers, vouchers…"
            className="h-8 w-64 rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm text-slate-600 placeholder:text-slate-400"
            aria-label="Global search (coming soon)"
          />
        </div>

        <FinancialYearSwitcher currentLabel={shell.financialYearLabel} />

        <span className="hidden text-xs text-slate-500 whitespace-nowrap xl:inline">{formatToday()}</span>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
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
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-slate-800 leading-tight">{shell.userName}</p>
            <p className="truncate text-[11px] text-slate-500">
              <Link href="/configuration/change-password" className="hover:text-blue-700">
                {shell.loginId}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
