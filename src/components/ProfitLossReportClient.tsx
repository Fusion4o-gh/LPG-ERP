"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/api-client";

type PlRow = {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  amount: number;
  monthlyAmounts?: Record<string, number>;
};

type ProfitLossReport = {
  revenueRows: PlRow[];
  expenseRows: PlRow[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  netLoss: number;
  result: string;
  months?: string[];
  monthlyTotals?: { revenue: Record<string, number>; expenses: Record<string, number>; net: Record<string, number> };
};

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function periodPreset(preset: "month" | "year") {
  const now = new Date();
  if (preset === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
  }
  const from = new Date(now.getFullYear(), 0, 1);
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

function StatementSection({
  title,
  rows,
  total,
  loading,
  accountLinkPrefix,
}: {
  title: string;
  rows: PlRow[];
  total: number;
  loading: boolean;
  accountLinkPrefix?: string;
}) {
  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Account Code</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Account Name</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={3} className="px-4 py-3">
                    <div className="h-3.5 rounded-md bg-slate-100 animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No accounts with movement in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/30">
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.accountCode}</td>
                  <td className="px-4 py-2.5 text-slate-800">
                    {accountLinkPrefix ? (
                      <Link href={`${accountLinkPrefix}?accountId=${row.id}`} className="text-blue-700 hover:underline">
                        {row.accountName}
                      </Link>
                    ) : (
                      row.accountName
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(row.amount)}</td>
                </tr>
              ))
            )}
            <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold">
              <td className="px-4 py-3 text-slate-700" colSpan={2}>
                Total {title}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MonthlyGrid({
  title,
  rows,
  months,
  totalByMonth,
  total,
  loading,
}: {
  title: string;
  rows: PlRow[];
  months: string[];
  totalByMonth?: Record<string, number>;
  total: number;
  loading: boolean;
}) {
  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Account</th>
              {months.map((month) => (
                <th key={month} className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                  {monthLabel(month)}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Period Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={months.length + 2} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={months.length + 2} className="px-4 py-8 text-center text-slate-500">
                  No accounts with movement in this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/30">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 text-slate-800">
                    <div className="font-medium">{row.accountName}</div>
                    <div className="text-xs text-slate-500 tabular-nums">{row.accountCode}</div>
                  </td>
                  {months.map((month) => (
                    <td key={month} className="px-3 py-2.5 text-right tabular-nums text-slate-800">
                      {money(row.monthlyAmounts?.[month] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-900">{money(row.amount)}</td>
                </tr>
              ))
            )}
            <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold">
              <td className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-slate-700">Total {title}</td>
              {months.map((month) => (
                <td key={month} className="px-3 py-3 text-right tabular-nums text-slate-900">
                  {money(totalByMonth?.[month] ?? 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right tabular-nums text-slate-900">{money(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProfitLossReportClient() {
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [breakdown, setBreakdown] = useState<"statement" | "month">("statement");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  function reportUrl(format?: "csv") {
    const params = new URLSearchParams(Object.entries({ ...filters, breakdown }).filter(([, value]) => value));
    if (format) params.set("format", format);
    const query = params.toString();
    return query ? `/api/reports/profit-loss?${query}` : "/api/reports/profit-loss";
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<ProfitLossReport>(reportUrl());
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report load failed.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString());
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setGeneratedAt(new Date().toLocaleString());
    load();
  }

  const months = report?.months ?? [];
  const monthlyView = breakdown === "month" && months.length > 0;
  const periodLabel = useMemo(() => {
    if (filters.from && filters.to) return `${filters.from} to ${filters.to}`;
    if (filters.from) return `From ${filters.from}`;
    if (filters.to) return `To ${filters.to}`;
    return "Full financial year";
  }, [filters]);

  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  return (
    <section data-report-print className="space-y-5">
      <div data-print-hidden>
        <PageHeader
          title="Profit & Loss Statement"
          description="Income and expenses for the selected period, with net profit or loss."
          actions={
            <>
              <a href={reportUrl("csv")} download className="btn-outline">
                CSV
              </a>
              <button type="button" onClick={() => window.print()} className="btn-outline">
                Print
              </button>
            </>
          }
        />
      </div>

      <div className="hidden print:block" data-print-only>
        <h1 className="text-xl font-semibold text-slate-950">Profit &amp; Loss Statement</h1>
        <p className="mt-1 text-sm text-slate-700">Period: {periodLabel}</p>
        <div className="mt-3 grid gap-1 text-xs text-slate-700">
          <div>Generated: {generatedAt || "Preparing…"}</div>
          <div>
            Filters: {activeFilters.length ? activeFilters.map(([key, value]) => `${key} ${value}`).join("; ") : "None"}
          </div>
        </div>
      </div>

      <form
        onSubmit={submit}
        data-print-hidden
        className="card rounded-xl p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end"
      >
        <div>
          <label className="form-label mb-1">From</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="form-input" />
        </div>
        <div>
          <label className="form-label mb-1">To</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="form-input" />
        </div>
        <div>
          <label className="form-label mb-1">Layout</label>
          <select value={breakdown} onChange={(e) => setBreakdown(e.target.value as "statement" | "month")} className="form-input">
            <option value="statement">Statement (totals)</option>
            <option value="month">Month / year columns</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 xl:col-span-2">
          <button type="button" onClick={() => setFilters(periodPreset("month"))} className="btn-outline text-xs">
            This month
          </button>
          <button type="button" onClick={() => setFilters(periodPreset("year"))} className="btn-outline text-xs">
            Year to date
          </button>
        </div>
        <button type="submit" className="btn-primary">
          Preview
        </button>
      </form>

      <ApiError message={error} />

      {!loading && report ? (
        <div className="grid gap-3 sm:grid-cols-3" data-print-hidden>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Revenue</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-emerald-900">{money(report.totalRevenue)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">Total Expenses</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-amber-950">{money(report.totalExpenses)}</div>
          </div>
          <div className={`rounded-lg border p-4 ${report.netProfit >= 0 ? "border-blue-200 bg-blue-50" : "border-red-200 bg-red-50"}`}>
            <div className={`text-xs font-semibold uppercase tracking-wide ${report.netProfit >= 0 ? "text-blue-700" : "text-red-700"}`}>
              Net {report.result}
            </div>
            <div className={`mt-1 text-xl font-bold tabular-nums ${report.netProfit >= 0 ? "text-blue-900" : "text-red-900"}`}>
              {money(report.netProfit >= 0 ? report.netProfit : report.netLoss)}
            </div>
          </div>
        </div>
      ) : null}

      {monthlyView && report ? (
        <>
          <MonthlyGrid
            title="Revenue / Income"
            rows={report.revenueRows}
            months={months}
            totalByMonth={report.monthlyTotals?.revenue}
            total={report.totalRevenue}
            loading={loading}
          />
          <MonthlyGrid
            title="Expenses"
            rows={report.expenseRows}
            months={months}
            totalByMonth={report.monthlyTotals?.expenses}
            total={report.totalExpenses}
            loading={loading}
          />
        </>
      ) : (
        <>
          <StatementSection
            title="Revenue / Income"
            rows={report?.revenueRows ?? []}
            total={report?.totalRevenue ?? 0}
            loading={loading}
            accountLinkPrefix="/reports/general-ledger"
          />
          <StatementSection
            title="Expenses"
            rows={report?.expenseRows ?? []}
            total={report?.totalExpenses ?? 0}
            loading={loading}
            accountLinkPrefix="/reports/general-ledger"
          />
        </>
      )}

      <section className="card rounded-xl overflow-hidden border-2 border-slate-200">
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-300">Net Result</div>
            <div className="mt-1 text-lg font-semibold">
              {loading ? "…" : report?.result === "Loss" ? "Net Loss" : "Net Profit"}
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {loading ? "…" : money(report && report.netProfit >= 0 ? report.netProfit : report?.netLoss ?? 0)}
          </div>
        </div>
        <div className="px-5 py-3 grid gap-2 sm:grid-cols-2 text-sm bg-slate-50 border-t border-slate-200">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Total revenue</span>
            <span className="font-medium tabular-nums text-slate-900">{money(report?.totalRevenue)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Total expenses</span>
            <span className="font-medium tabular-nums text-slate-900">{money(report?.totalExpenses)}</span>
          </div>
        </div>
      </section>
    </section>
  );
}
