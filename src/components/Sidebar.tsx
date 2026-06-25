"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { canAccess } from "@/lib/permissions";
import { filterModules, moduleSidebarHref, rememberModuleTab, resolveModule } from "@/lib/navigation/modules";
import type { AppShellContext } from "@/server/auth/app-shell-context";
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
  "sale-purchase": {
    idle: "border-emerald-100 bg-emerald-50 text-emerald-600",
    active: "border-transparent bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm",
    bar: "bg-emerald-500",
    row: "bg-emerald-50 text-emerald-800",
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
  const visibleModules = useMemo(() => filterModules(permissions), [permissions]);
  const activeModule = useMemo(() => resolveModule(pathname, visibleModules)?.module.id, [pathname, visibleModules]);
  const canViewDashboard = canAccess(permissions, "dashboard", "VIEW");
  const dashboardActive = pathname === "/dashboard";

  return (
    <aside
      data-print-hidden
      className="flex h-screen w-72 max-w-[85vw] shrink-0 flex-col"
      style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
    >
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
            style={{ background: "var(--fusion-gradient)" }}
          >
            <img src="/fusion4o-logo.png" alt="LPG Management System" className="h-7 w-7 object-contain" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[15px] font-bold text-[color:var(--sidebar-heading)] leading-tight tracking-tight">
              {shell.companyName}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--sidebar-text)" }}>
              LPG Management System · FY {shell.financialYearLabel}
            </div>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden rounded-md p-1 text-[color:var(--sidebar-muted)] hover:text-[color:var(--sidebar-heading)] transition-colors"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {canViewDashboard ? (
          (() => {
            const theme = MODULE_THEME.dashboard ?? DEFAULT_THEME;
            return (
              <Link
                href="/dashboard"
                className={`group relative mb-2 flex items-center gap-3 rounded-xl px-2.5 py-2 transition-all ${
                  dashboardActive ? theme.row : "text-[color:var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition-all ${
                    dashboardActive ? theme.bar : "bg-transparent"
                  }`}
                  aria-hidden
                />
                <SidebarIcon name="dashboard" className={dashboardActive ? theme.active : theme.idle} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">Dashboard</span>
                  <span className={`block text-[10px] leading-tight ${dashboardActive ? "opacity-70" : "text-[color:var(--sidebar-muted)]"}`}>
                    Overview
                  </span>
                </span>
              </Link>
            );
          })()
        ) : null}

        {visibleModules.map((module) => {
          const href = moduleSidebarHref(module, permissions);
          const isActive = activeModule === module.id;
          const theme = MODULE_THEME[module.id] ?? DEFAULT_THEME;
          return (
            <Link
              key={module.id}
              href={href}
              onClick={() => rememberModuleTab(module.id, href)}
              className={`group relative mb-1.5 flex items-center gap-3 rounded-xl px-2.5 py-2 transition-all ${
                isActive ? theme.row : "text-[color:var(--sidebar-text)] hover:bg-[var(--sidebar-hover-bg)]"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition-all ${
                  isActive ? theme.bar : "bg-transparent"
                }`}
                aria-hidden
              />
              <SidebarIcon name={module.icon} className={isActive ? theme.active : theme.idle} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight">{module.label}</span>
                <span className={`block text-[10px] leading-tight ${isActive ? "opacity-70" : "text-[color:var(--sidebar-muted)]"}`}>
                  Module
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 space-y-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-3 px-2">
          {shell.logoUrl ? (
            <img src={shell.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-contain border border-[var(--sidebar-border)]" aria-hidden />
          ) : (
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
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[color:var(--sidebar-heading)] leading-tight">{shell.userName}</p>
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
