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
    <div className="min-h-screen" style={{ background: 'var(--skeu-surface)' }}>
      <ThemeHydrator themeId={shell.themeId} />

      {/* Faint accent tint behind the sidebar — subtle Mica-style depth, not a colorful wash */}
      <div aria-hidden className="pointer-events-none fixed inset-y-0 left-0 z-0 w-72 overflow-hidden">
        <div
          className="absolute -left-16 -top-16 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #F28C28 0%, transparent 70%)' }}
        />
        <div
          className="absolute -left-12 top-1/2 h-80 w-80 rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)' }}
        />
        <div
          className="absolute -left-14 bottom-0 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }}
        />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-gas-900/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="min-h-screen">
        {/* Sidebar — fixed drawer on mobile and fixed rail on desktop */}
        <div
          className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar permissions={permissions} shell={shell} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Content column */}
        <div className="flex min-h-screen min-w-0 flex-col md:pl-72">
          {/* Mobile top-bar */}
          <header
            data-print-hidden
            className="sticky top-0 z-20 flex h-12 items-center gap-3 px-4 md:hidden"
            style={{ background: 'linear-gradient(180deg, #0F3150, #123A5A)', borderBottom: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-flame-300 hover:text-white transition-colors"
              aria-label="Open navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <img src="/fusion4o-logo.png" alt="" className="h-6 w-6 object-contain" aria-hidden="true" />
              <span className="truncate text-sm font-bold text-white tracking-tight">{shell.companyName}</span>
            </div>
            {(() => {
              const canSales = canAccess(permissions, "sale-lpg", "VIEW");
              if (!canSales) return null;
              return (
                <Link
                  href="/sales"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ background: 'var(--flame-gradient)', boxShadow: 'var(--skeu-shadow-sm)' }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16" /><path d="M7 4h10l2 3v13H5V7l2-3z" /><path d="M9 11h6" /><path d="M9 15h4" />
                  </svg>
                </Link>
              );
            })()}
            <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--flame-gradient)', boxShadow: 'var(--skeu-shadow-sm)' }}>
              FY {shell.financialYearLabel}
            </span>
          </header>

          <Topbar shell={shell} permissions={permissions} />

          <ModuleTabBar permissions={permissions} />

          <main className="flex-1 p-5 md:p-7">
            <ModuleTransition>{children}</ModuleTransition>
          </main>
        </div>
      </div>
    </div>
  );
}
