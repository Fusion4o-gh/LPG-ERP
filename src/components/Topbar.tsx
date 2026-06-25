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
      className="app-topbar sticky top-0 z-20 hidden h-12 shrink-0 items-center gap-4 border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-md md:flex"
    >
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span className="text-slate-300">/</span> : null}
              {isLast ? (
                <span className="truncate font-semibold text-slate-900">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="accent-link truncate transition-colors">
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
          {shell.logoUrl ? (
            <img src={shell.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-contain border border-slate-200" aria-hidden />
          ) : (
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
          )}
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-slate-800 leading-tight">{shell.userName}</p>
            <p className="truncate text-[11px] text-slate-500">
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
