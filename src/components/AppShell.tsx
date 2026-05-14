"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children, permissions }: { children: React.ReactNode; permissions: string[] }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="md:flex min-h-screen">
        {/* Sidebar — fixed drawer on mobile, static column on desktop */}
        <div
          className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <Sidebar permissions={permissions} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Content column */}
        <div className="flex flex-1 min-w-0 flex-col">
          {/* Mobile top-bar */}
          <header
            data-print-hidden
            className="sticky top-0 z-20 flex h-13 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm md:hidden"
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"
              aria-label="Open navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/fusion4o-logo.png" alt="" className="h-6 w-6 object-contain" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-900 tracking-tight">LPG ERP</span>
            </div>
          </header>

          <main className="flex-1 p-5 md:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
}
