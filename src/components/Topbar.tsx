"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { breadcrumbsForPath } from "@/lib/navigation/modules";
import type { AppShellContext } from "@/server/auth/app-shell-context";
import { FinancialYearSwitcher } from "./FinancialYearSwitcher";

function formatToday() {
  return new Date().toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function Topbar({ shell, permissions }: { shell: AppShellContext; permissions: string[] }) {
  const pathname = usePathname();
  const crumbs = useMemo(() => breadcrumbsForPath(pathname, permissions), [pathname, permissions]);

  return (
    <header
      data-print-hidden
      className="app-topbar sticky top-0 z-20 hidden h-12 shrink-0 items-center gap-4 px-5 backdrop-blur-md md:flex"
      style={{ background: 'linear-gradient(180deg, #FAFAF7, #f0f0ea)', borderBottom: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)' }}
    >
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-steel-500">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span className="text-steel-300">/</span> : null}
              {isLast ? (
                <span className="truncate font-bold text-gas-700">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="accent-link truncate transition-colors font-medium">
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
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-400"
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
            className="h-8 w-64 rounded-lg px-3 pl-9 text-sm text-steel-600 placeholder:text-steel-400"
            style={{ background: 'var(--skeu-input)', boxShadow: 'var(--skeu-shadow-inset-sm), 0 0 0 1px rgba(0,0,0,0.04)' }}
            aria-label="Global search (coming soon)"
          />
        </div>

        <FinancialYearSwitcher currentLabel={shell.financialYearLabel} />

        <span className="hidden text-xs text-steel-400 whitespace-nowrap xl:inline">{formatToday()}</span>

        <div className="flex items-center gap-2 pl-3" style={{ borderLeft: '1px solid rgba(0,0,0,0.08)' }}>
          {shell.logoUrl ? (
            <img src={shell.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-contain" style={{ border: '2px solid rgba(242,140,40,0.3)' }} aria-hidden />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: 'var(--flame-gradient)', boxShadow: '2px 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)' }}
              aria-hidden
            >
              {shell.userName
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-gas-700 leading-tight">{shell.userName}</p>
            <p className="truncate text-[11px] text-steel-400">
              <Link href="/configuration/change-password" className="accent-link">
                {shell.loginId}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
