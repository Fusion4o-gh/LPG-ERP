"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "@/components/ApiError";

type KpiData = {
  todayCash: number;
  cashPosition: number;
  receivables: number;
  payables: number;
  todaySale: number;
  expenses: number;
  mExpenses: number;
};

type BankRow = {
  id: string;
  name: string;
  accountCode: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type StockRow = {
  id: string;
  itemCode: string;
  itemName: string;
  filled: number;
  empty: number;
};

type SaleStats = {
  today: { count: number; amount: number };
  month: { count: number; amount: number };
};

type DashboardData = {
  kpis: KpiData;
  bankPosition: BankRow[];
  currentStock: StockRow[];
  saleStats: SaleStats;
};

const QUICK_LINKS = [
  { label: "Single Sale", href: "/transactions/single-sale" },
  { label: "Complete Day Sale", href: "/transactions/complete-day-sale" },
  { label: "Purchase", href: "/transactions/purchase" },
  { label: "Payment", href: "/transactions/payment" },
  { label: "Receipt", href: "/transactions/receipt" },
  { label: "Cylinder Return", href: "/transactions/cylinder-return" },
  { label: "Customer Ledger", href: "/reports/customer-ledger" },
  { label: "Stock Report", href: "/reports/stock-summary" },
  { label: "Daily Activity", href: "/reports/daily-activity" },
  { label: "Customer Stock Ledger", href: "/reports/customer-cylinder-balances" },
  { label: "Cash Book", href: "/reports/cash-book" },
  { label: "Profit/Loss Report", href: "/reports/profit-loss" },
];

const KPI_DEFS = [
  { key: "todayCash" as const, label: "Today Cash", icon: "💵" },
  { key: "cashPosition" as const, label: "Cash Position", icon: "🏦" },
  { key: "payables" as const, label: "Payables", icon: "📤" },
  { key: "receivables" as const, label: "Receivables", icon: "📥" },
  { key: "todaySale" as const, label: "Today's Sale", icon: "🛒" },
  { key: "expenses" as const, label: "Expenses", icon: "📊" },
  { key: "mExpenses" as const, label: "Month Expenses", icon: "📅" },
];

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="card rounded-xl p-4 space-y-3">
          <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          <div className="h-7 w-32 rounded bg-slate-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Load failed."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <KpiSkeleton />;

  return (
    <>
      <ApiError message={error} />

      {/* KPI tiles */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
          {KPI_DEFS.map((kpi) => (
            <div key={kpi.key} className="card rounded-xl p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-800 tabular-nums leading-none">
                  {fmt(data.kpis[kpi.key])}
                </p>
              </div>
              <span className="text-xl mt-0.5 select-none" aria-hidden="true">{kpi.icon}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2 mb-5">
        {/* Bank Position */}
        {data && data.bankPosition.length > 0 && (
          <div className="card rounded-xl overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/70">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Bank Position</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 bg-slate-50/70">Bank</th>
                    <th className="px-4 py-2.5 text-right bg-slate-50/70">Debit</th>
                    <th className="px-4 py-2.5 text-right bg-slate-50/70">Credit</th>
                    <th className="px-4 py-2.5 text-right bg-slate-50/70">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.bankPosition.map((b) => (
                    <tr key={b.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-700 font-medium">{b.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{fmt(b.totalDebit)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{fmt(b.totalCredit)}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${b.balance >= 0 ? "text-blue-700" : "text-red-600"}`}>
                        {fmt(b.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sale Stats */}
        {data && (
          <div className="card rounded-xl overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/70">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sale Stats</p>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { label: "Today — Transactions", value: String(data.saleStats.today.count) },
                { label: "Today — Amount", value: fmt(data.saleStats.today.amount) },
                { label: "This Month — Transactions", value: String(data.saleStats.month.count) },
                { label: "This Month — Amount", value: fmt(data.saleStats.month.amount) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm text-slate-500">{row.label}</p>
                  <p className="text-sm font-semibold tabular-nums text-slate-800">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current Stock */}
      {data && data.currentStock.length > 0 && (
        <div className="card rounded-xl overflow-hidden mb-5">
          <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/70">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Current Stock</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 bg-slate-50/70">Item</th>
                  <th className="px-4 py-2.5 text-right bg-slate-50/70">Filled</th>
                  <th className="px-4 py-2.5 text-right bg-slate-50/70">Empty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.currentStock.map((s) => (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700">
                      <span className="font-medium text-slate-900">{s.itemCode}</span>
                      <span className="ml-2 text-slate-400 text-xs">{s.itemName}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-blue-700">{s.filled}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{s.empty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="card rounded-xl overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 bg-slate-50/70">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Quick Links</p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => router.push(link.href)}
              className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-left text-sm font-medium text-blue-800 hover:bg-blue-100 hover:border-blue-200 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
