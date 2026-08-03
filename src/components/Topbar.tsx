"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { breadcrumbsForPath } from "@/lib/navigation/modules";
import { canAccess } from "@/lib/permissions";
import type { AppShellContext } from "@/server/auth/app-shell-context";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { FinancialYearSwitcher } from "./FinancialYearSwitcher";
import { GlobalSearch } from "./GlobalSearch";

function formatToday() {
  return new Date().toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function Topbar({ shell, permissions }: { shell: AppShellContext; permissions: string[] }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const crumbs = useMemo(() => breadcrumbsForPath(pathname, permissions), [pathname, permissions]);

  return (
    <header
      data-print-hidden
      className="app-topbar sticky top-0 z-20 hidden h-11 shrink-0 items-center gap-3 border-b border-[var(--surface-border)] bg-white px-4 md:flex"
    >
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-steel-500">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={`${crumb.href}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span className="text-steel-300">/</span> : null}
              {isLast ? (
                <span className="truncate font-bold text-gas-700">{t(crumb.label)}</span>
              ) : (
                <Link href={crumb.href} className="accent-link truncate font-medium">
                  {t(crumb.label)}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="mx-auto w-full max-w-md min-w-[220px] flex-1 px-2">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {(() => {
          const canSales = canAccess(permissions, "sale-lpg", "VIEW");
          const canPurchases = canAccess(permissions, "purchase-filled-cylinders", "VIEW");
          if (!canSales && !canPurchases) return null;
          return (
            <div className="flex items-center gap-1.5">
              {canSales ? (
                <Link href="/operations/sale-lpg" className="btn-primary-sm">
                  {t("Sales")}
                </Link>
              ) : null}
              {canPurchases ? (
                <Link href="/purchases/filled-cylinder" className="btn-outline !py-1.5 !px-2.5 !text-xs">
                  {t("Purchases")}
                </Link>
              ) : null}
            </div>
          );
        })()}

        <FinancialYearSwitcher currentLabel={shell.financialYearLabel} />

        <span className="hidden text-xs text-steel-400 whitespace-nowrap xl:inline">{formatToday()}</span>

        <div className="flex items-center gap-2 border-l border-[var(--surface-border)] pl-3">
          {shell.logoUrl ? (
            <img src={shell.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-contain border border-[var(--surface-border)]" aria-hidden />
          ) : (
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gas-600 text-[10px] font-bold text-white"
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
              <Link href="/configuration/profile" className="accent-link">
                {shell.loginId}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
