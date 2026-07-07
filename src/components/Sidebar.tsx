"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { canAccess } from "@/lib/permissions";
import { filterModules, moduleSidebarHref, rememberModuleTab, resolveModule } from "@/lib/navigation/modules";
import type { AppShellContext } from "@/server/auth/app-shell-context";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LogoutButton } from "./LogoutButton";

/**
 * Per-module color coding. Each module gets a distinct hue so users can
 * navigate the rail by color memory. Classes are written as full literals so
 * Tailwind's JIT compiler keeps them.
 */
type ModuleTheme = { idle: string; active: string; bar: string; row: string };

const MODULE_THEME: Record<string, ModuleTheme> = {
  dashboard: {
    idle: "border-blue-100 bg-blue-50 text-blue-600",
    active: "border-transparent bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm",
    bar: "bg-blue-500",
    row: "bg-blue-50 text-blue-800",
  },
  configuration: {
    idle: "border-violet-100 bg-violet-50 text-violet-600",
    active: "border-transparent bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm",
    bar: "bg-violet-500",
    row: "bg-violet-50 text-violet-800",
  },
  sales: {
    idle: "border-emerald-100 bg-emerald-50 text-emerald-600",
    active: "border-transparent bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm",
    bar: "bg-emerald-500",
    row: "bg-emerald-50 text-emerald-800",
  },
  purchases: {
    idle: "border-indigo-100 bg-indigo-50 text-indigo-600",
    active: "border-transparent bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm",
    bar: "bg-indigo-500",
    row: "bg-indigo-50 text-indigo-800",
  },
  stock: {
    idle: "border-sky-100 bg-sky-50 text-sky-600",
    active: "border-transparent bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-sm",
    bar: "bg-sky-500",
    row: "bg-sky-50 text-sky-800",
  },
  returns: {
    idle: "border-amber-100 bg-amber-50 text-amber-600",
    active: "border-transparent bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm",
    bar: "bg-amber-500",
    row: "bg-amber-50 text-amber-800",
  },
  "payment-receipt": {
    idle: "border-indigo-100 bg-indigo-50 text-indigo-600",
    active: "border-transparent bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm",
    bar: "bg-indigo-500",
    row: "bg-indigo-50 text-indigo-800",
  },
  reports: {
    idle: "border-cyan-100 bg-cyan-50 text-cyan-600",
    active: "border-transparent bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-sm",
    bar: "bg-cyan-500",
    row: "bg-cyan-50 text-cyan-800",
  },
  database: {
    idle: "border-rose-100 bg-rose-50 text-rose-600",
    active: "border-transparent bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-sm",
    bar: "bg-rose-500",
    row: "bg-rose-50 text-rose-800",
  },
  import: {
    idle: "border-sky-100 bg-sky-50 text-sky-600",
    active: "border-transparent bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm",
    bar: "bg-sky-500",
    row: "bg-sky-50 text-sky-800",
  },
  plant: {
    idle: "border-teal-100 bg-teal-50 text-teal-600",
    active: "border-transparent bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm",
    bar: "bg-teal-500",
    row: "bg-teal-50 text-teal-800",
  },
  dollar: {
    idle: "border-green-100 bg-green-50 text-green-600",
    active: "border-transparent bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-sm",
    bar: "bg-green-500",
    row: "bg-green-50 text-green-800",
  },
};

const DEFAULT_THEME: ModuleTheme = MODULE_THEME.dashboard;

function SidebarIcon({ name, className }: { name: string; className: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
  };

  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <path d="M4 13h7V4H4v9z" />
        <path d="M13 20h7V4h-7v16z" />
        <path d="M4 20h7v-5H4v5z" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z" />
        <path d="M19 12a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-1.9-1.1L14.3 3h-4.6l-.4 2.9A7.4 7.4 0 0 0 7.5 7l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.1l-2 1.5 2 3.4 2.4-1c.6.5 1.2.9 1.9 1.1l.4 2.9h4.6l.4-2.9c.7-.3 1.3-.6 1.9-1.1l2.4 1 2-3.4-2-1.5c0-.3.1-.7.1-1.1z" />
      </>
    ),
    sales: (
      <>
        <path d="M4 7h16" />
        <path d="M7 4h10l2 3v13H5V7l2-3z" />
        <path d="M9 11h6" />
        <path d="M9 15h4" />
      </>
    ),
    purchases: (
      <>
        <path d="M4 7h16" />
        <path d="M7 4h10l2 3v13H5V7l2-3z" />
        <path d="M9 11l2 2 4-4" />
        <path d="M9 17h6" />
      </>
    ),
    returns: (
      <>
        <path d="M9 7H5v4" />
        <path d="M5 11a7 7 0 1 0 2-5" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    money: (
      <>
        <path d="M4 7h16v10H4z" />
        <path d="M7 10h.01" />
        <path d="M17 14h.01" />
        <path d="M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      </>
    ),
    reports: (
      <>
        <path d="M5 20V4h14v16z" />
        <path d="M9 9h6" />
        <path d="M9 13h6" />
        <path d="M9 17h3" />
      </>
    ),
    database: (
      <>
        <path d="M5 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
        <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </>
    ),
    import: (
      <>
        <path d="M3 13h13V8H3z" />
        <path d="M16 10h3l2 3v3h-5z" />
        <path d="M7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19z" />
        <path d="M17 19a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z" />
      </>
    ),
    plant: (
      <>
        <path d="M4 21V9l6 3V9l6 3V6l4 2v13z" />
        <path d="M8 21v-3" />
        <path d="M14 21v-3" />
      </>
    ),
    dollar: (
      <>
        <path d="M12 3v18" />
        <path d="M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.6 8 7.5s1.8 2.6 4 3 4 1.1 4 3-1.8 3-4 3-4-1.1-4-3" />
      </>
    ),
    warehouse: (
      <>
        <path d="M2 20V8l10-5 10 5v12" />
        <path d="M6 14v6" />
        <path d="M10 14v6" />
        <path d="M14 14v6" />
        <path d="M18 14v6" />
        <path d="M2 20h20" />
      </>
    ),
  };

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 ${className}`}
    >
      <svg aria-hidden="true" className="h-[18px] w-[18px]" {...common}>
        {paths[name] ?? paths.dashboard}
      </svg>
    </span>
  );
}

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
  const { t } = useLanguage();
  const visibleModules = useMemo(() => filterModules(permissions), [permissions]);
  const activeModule = useMemo(() => resolveModule(pathname, visibleModules)?.module.id, [pathname, visibleModules]);
  const canViewDashboard = canAccess(permissions, "dashboard", "VIEW");
  const dashboardActive = pathname === "/dashboard";

  return (
    <aside
      data-print-hidden
      className="relative m-3 flex h-[calc(100vh-1.5rem)] w-72 max-w-[85vw] shrink-0 flex-col overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(165deg, rgba(16,52,82,0.86) 0%, rgba(10,34,58,0.82) 50%, rgba(13,44,72,0.86) 100%)',
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.14)',
      }}
    >
      {/* Glass sheen highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 100%)' }}
      />
      {/* Faint noise texture to simulate real glass grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          opacity: 0.05,
          mixBlendMode: 'overlay',
        }}
      />
      {/* Brand header — no logo */}
      <div className="relative px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="truncate text-[15px] font-bold text-white leading-tight tracking-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
              {shell.companyName}
            </div>
            <div className="text-[11px] mt-0.5 text-flame-200">
              LPG Management System · FY {shell.financialYearLabel}
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden rounded-md p-1 text-steel-300 hover:text-white transition-colors"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <nav className="relative flex-1 overflow-y-auto px-3 py-3">
        {canViewDashboard ? (
          (() => {
            return (
              <Link
                href="/dashboard"
                className={`group relative mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  dashboardActive
                    ? 'sidebar-link-active'
                    : 'text-slate-200 sidebar-link-hover'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
                    dashboardActive
                      ? "border-flame-400/40 bg-white/14 text-flame-300 shadow-[0_0_14px_rgba(242,140,40,0.45)]"
                      : "border-white/10 bg-white/[0.06] text-slate-300 group-hover:border-flame-400/30 group-hover:bg-white/10 group-hover:text-flame-300 group-hover:shadow-[0_0_10px_rgba(242,140,40,0.3)]"
                  }`}
                >
                  <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path d="M4 13h7V4H4v9z" /><path d="M13 20h7V4h-7v16z" /><path d="M4 20h7v-5H4v5z" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold leading-tight ${dashboardActive ? 'text-white' : 'text-slate-100 group-hover:text-white'}`}>{t("Dashboard")}</span>
                  <span className={`block text-[10px] leading-tight ${dashboardActive ? 'text-flame-200' : 'text-slate-400'}`}>{t("Overview")}</span>
                </span>
              </Link>
            );
          })()
        ) : null}

        {visibleModules.map((module) => {
          const href = moduleSidebarHref(module, permissions);
          const isActive = activeModule === module.id;
          return (
            <Link
              key={module.id}
              href={href}
              onClick={() => rememberModuleTab(module.id, href)}
              className={`group relative mb-1.5 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                isActive
                  ? 'sidebar-link-active'
                  : 'text-slate-200 sidebar-link-hover'
              }`}
            >
              <SidebarIcon
                name={module.icon}
                className={isActive
                  ? "border-flame-400/40 bg-white/14 text-flame-300 shadow-[0_0_14px_rgba(242,140,40,0.45)]"
                  : "border-white/10 bg-white/[0.06] text-slate-300 group-hover:border-flame-400/30 group-hover:bg-white/10 group-hover:text-flame-300 group-hover:shadow-[0_0_10px_rgba(242,140,40,0.3)]"}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold leading-tight ${isActive ? 'text-white' : 'text-slate-100 group-hover:text-white'}`}>{t(module.label)}</span>
                <span className={`block text-[10px] leading-tight ${isActive ? 'text-flame-200' : 'text-slate-400'}`}>{t("Module")}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3 px-2">
          {shell.logoUrl ? (
            <img src={shell.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-contain" style={{ border: '2px solid rgba(242,140,40,0.3)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} aria-hidden />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: 'var(--flame-gradient)', boxShadow: '2px 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)' }}
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
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white leading-tight">{shell.userName}</p>
            <p className="truncate text-[11px] text-flame-200">{shell.loginId}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
