"use client";

import Link from "next/link";
import { useState } from "react";
import { canAccess } from "@/lib/permissions";
import type { AppShellContext } from "@/server/auth/app-shell-context";
import { ModuleTabBar } from "./ModuleTabBar";
import { ModuleTransition } from "./ModuleTransition";
import { Sidebar } from "./Sidebar";
import { ThemeHydrator } from "./ThemeHydrator";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  permissions,
  shell,
}: {
  children: React.ReactNode;
  permissions: string[];
  shell: AppShellContext;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--surface-bg)]">
      <ThemeHydrator themeId={shell.themeId} />

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-gas-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="min-h-screen">
        <div
          className={`fixed inset-y-0 left-0 z-40 transition-transform duration-150 md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar permissions={permissions} shell={shell} onClose={() => setSidebarOpen(false)} />
        </div>

        <div className="flex min-h-screen min-w-0 flex-col md:pl-60">
          <header
            data-print-hidden
            className="sticky top-0 z-20 flex h-11 items-center gap-3 border-b border-white/10 bg-gas-600 px-3 md:hidden"
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-white/80 hover:text-white"
              aria-label="Open navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <img src="/fusion4o-logo.png" alt="" className="h-5 w-5 object-contain" aria-hidden="true" />
              <span className="truncate text-sm font-bold text-white tracking-tight">{shell.companyName}</span>
            </div>
            {canAccess(permissions, "sale-lpg", "VIEW") ? (
              <Link
                href="/operations/sale-lpg"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gas-500 text-white"
                aria-label="Sale LPG"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16" /><path d="M7 4h10l2 3v13H5V7l2-3z" /><path d="M9 11h6" /><path d="M9 15h4" />
                </svg>
              </Link>
            ) : null}
            <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold text-flame-200 bg-white/10">
              FY {shell.financialYearLabel}
            </span>
          </header>

          <Topbar shell={shell} permissions={permissions} />
          <ModuleTabBar permissions={permissions} />

          <main className="flex-1 p-3 md:p-4">
            <ModuleTransition>{children}</ModuleTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
