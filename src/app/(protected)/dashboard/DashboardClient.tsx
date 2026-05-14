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

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

  if (loading) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  return (
    <>
      <ApiError message={error} />

      {/* KPI tiles */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
          {[
            { label: "Today Cash", value: data.kpis.todayCash },
            { label: "Cash Position", value: data.kpis.cashPosition },
            { label: "Payables", value: data.kpis.payables },
            { label: "Receivables", value: data.kpis.receivables },
            { label: "Today's Sale", value: data.kpis.todaySale },
            { label: "Expenses", value: data.kpis.expenses },
            { label: "M Expenses", value: data.kpis.mExpenses },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{kpi.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-800 tabular-nums">{fmt(kpi.value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2 mb-5">
        {/* Bank Position */}
        {data && data.bankPosition.length > 0 && (
          <div className="rounded-xl border border-blue-100 bg-white shadow-sm">
            <div className="border-b border-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Bank Position</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-blue-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <th className="px-4 py-2">Bank</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bankPosition.map((b) => (
                    <tr key={b.id} className="border-t border-blue-50">
                      <td className="px-4 py-2 text-slate-700">{b.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{fmt(b.totalDebit)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{fmt(b.totalCredit)}</td>
                      <td className={`px-4 py-2 text-right tabular-nums font-semibold ${b.balance >= 0 ? "text-blue-700" : "text-red-600"}`}>
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
          <div className="rounded-xl border border-blue-100 bg-white shadow-sm">
            <div className="border-b border-blue-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">Sale Stats</p>
            </div>
            <div className="divide-y divide-blue-50">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-slate-600">Today — Transactions</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{data.saleStats.today.count}</p>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-slate-600">Today — Amount</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{fmt(data.saleStats.today.amount)}</p>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-slate-600">This Month — Transactions</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{data.saleStats.month.count}</p>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-slate-600">This Month — Amount</p>
                <p className="text-sm font-semibold tabular-nums text-slate-800">{fmt(data.saleStats.month.amount)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current Stock */}
      {data && data.currentStock.length > 0 && (
        <div className="rounded-xl border border-blue-100 bg-white shadow-sm mb-5">
          <div className="border-b border-blue-50 px-4 py-3">
            <p className="text-sm font-semibold text-slate-700">Current Stock</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-right">Filled</th>
                  <th className="px-4 py-2 text-right">Empty</th>
                </tr>
              </thead>
              <tbody>
                {data.currentStock.map((s) => (
                  <tr key={s.id} className="border-t border-blue-50">
                    <td className="px-4 py-2 text-slate-700">
                      <span className="font-medium">{s.itemCode}</span>
                      <span className="ml-2 text-slate-400 text-xs">{s.itemName}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-blue-700">{s.filled}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{s.empty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="rounded-xl border border-blue-100 bg-white shadow-sm">
        <div className="border-b border-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">Quick Links</p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => router.push(link.href)}
              className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
