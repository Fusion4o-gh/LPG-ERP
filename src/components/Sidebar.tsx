"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { canAccess } from "@/lib/permissions";
import { filterModules, moduleSidebarHref, rememberModuleTab, resolveModule } from "@/lib/navigation/modules";
import type { AppShellContext } from "@/server/auth/app-shell-context";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LogoutButton } from "./LogoutButton";

/** Subtle zone tint for active rail item — color + flame tick (never color alone). */
type ModuleTheme = { tick: string; tint: string };

const MODULE_THEME: Record<string, ModuleTheme> = {
  dashboard: { tick: "bg-sky-400", tint: "bg-sky-500/15" },
  configuration: { tick: "bg-violet-400", tint: "bg-violet-500/15" },
  sales: { tick: "bg-emerald-400", tint: "bg-emerald-500/15" },
  purchases: { tick: "bg-indigo-400", tint: "bg-indigo-500/15" },
  stock: { tick: "bg-cyan-400", tint: "bg-cyan-500/15" },
  returns: { tick: "bg-amber-400", tint: "bg-amber-500/15" },
  "payment-receipt": { tick: "bg-blue-400", tint: "bg-blue-500/15" },
  reports: { tick: "bg-teal-400", tint: "bg-teal-500/15" },
  database: { tick: "bg-rose-400", tint: "bg-rose-500/15" },
  import: { tick: "bg-sky-400", tint: "bg-sky-500/15" },
  plant: { tick: "bg-teal-400", tint: "bg-teal-500/15" },
  dollar: { tick: "bg-green-400", tint: "bg-green-500/15" },
};

const DEFAULT_THEME: ModuleTheme = MODULE_THEME.dashboard;

function SidebarIcon({ name }: { name: string }) {
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
    <span className="flex h-7 w-7 shrink-0 items-center justify-center text-current">
      <svg aria-hidden="true" className="h-4 w-4" {...common}>
        {paths[name] ?? paths.dashboard}
      </svg>
    </span>
  );
}

function NavRow({
  href,
  label,
  sublabel,
  icon,
  isActive,
  theme,
  onNavigate,
}: {
  href: string;
  label: string;
  sublabel?: string;
  icon: string;
  isActive: boolean;
  theme: ModuleTheme;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`group relative mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 ${
        isActive ? `sidebar-link-active text-white ${theme.tint}` : "text-slate-200 sidebar-link-hover"
      }`}
    >
      {isActive ? (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-[var(--flame-orange)]" aria-hidden />
      ) : null}
      <span className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r opacity-0 ${theme.tick} group-hover:opacity-40`} aria-hidden />
      <SidebarIcon name={icon} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-semibold leading-tight ${isActive ? "text-white" : "text-slate-100"}`}>
          {label}
        </span>
        {sublabel ? (
          <span className={`block text-[10px] leading-tight ${isActive ? "text-flame-200" : "text-slate-400"}`}>{sublabel}</span>
        ) : null}
      </span>
    </Link>
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
      className="flex h-screen w-60 max-w-[85vw] shrink-0 flex-col border-r border-white/10 bg-gas-700"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-white leading-tight">{shell.companyName}</div>
          <div className="mt-0.5 text-[10px] text-flame-200">LPG ERP · FY {shell.financialYearLabel}</div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-steel-300 hover:text-white md:hidden"
            aria-label="Close navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {canViewDashboard ? (
          <NavRow
            href="/dashboard"
            label={t("Dashboard")}
            sublabel={t("Overview")}
            icon="dashboard"
            isActive={dashboardActive}
            theme={MODULE_THEME.dashboard}
          />
        ) : null}

        {visibleModules.map((module) => {
          const href = moduleSidebarHref(module, permissions);
          const isActive = activeModule === module.id;
          const theme = MODULE_THEME[module.id] ?? DEFAULT_THEME;
          return (
            <NavRow
              key={module.id}
              href={href}
              label={t(module.label)}
              icon={module.icon}
              isActive={isActive}
              theme={theme}
              onNavigate={() => rememberModuleTab(module.id, href)}
            />
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-white/10 px-2 py-3">
        <div className="flex items-center gap-2.5 px-2">
          {shell.logoUrl ? (
            <img src={shell.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-contain border border-flame-400/40" aria-hidden />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--flame-orange)] text-[10px] font-bold text-white"
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
            <p className="truncate text-[11px] text-slate-400">{shell.loginId}</p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
