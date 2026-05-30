"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
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
  accountId: string;
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
  backup: {
    lastBackupAt: string | null;
    backupStaleDays: number | null;
    needsFirstBackup: boolean;
    isStale: boolean;
  };
};

const QUICK_LINKS = [
  { label: "Single Sale", href: "/operations/sale-lpg" },
  { label: "Complete Day Sale", href: "/operations/complete-day-sale" },
  { label: "Purchase", href: "/operations/purchase-filled-cylinder" },
  { label: "Payment", href: "/payments/cash-payment" },
  { label: "Receipt", href: "/payments/cash-receipt" },
  { label: "Cylinder Return", href: "/operations/cylinder-return" },
  { label: "Customer Ledger", href: "/reports/customer-ledger" },
  { label: "Stock Report", href: "/reports/stock-summary" },
  { label: "Daily Activity", href: "/reports/daily-activity" },
  { label: "Customer Stock Ledger", href: "/reports/customer-stock-ledger" },
  { label: "Cash Book", href: "/reports/cash-book" },
  { label: "Profit/Loss Report", href: "/reports/profit-loss" },
];

const KPI_DEFS = [
  { key: "todayCash" as const, label: "Today Cash", icon: "cash", tone: "emerald" },
  { key: "cashPosition" as const, label: "Cash Position", icon: "bank", tone: "blue" },
  { key: "payables" as const, label: "Payables", icon: "arrowUp", tone: "rose" },
  { key: "receivables" as const, label: "Receivables", icon: "arrowDown", tone: "amber" },
  { key: "todaySale" as const, label: "Today's Sale", icon: "sale", tone: "indigo" },
  { key: "expenses" as const, label: "Expenses", icon: "receipt", tone: "orange" },
  { key: "mExpenses" as const, label: "Month Expenses", icon: "calendar", tone: "violet" },
];

/** Semantic color per KPI. Full literal classes so Tailwind JIT keeps them. */
const KPI_TONE: Record<string, { chip: string; bar: string }> = {
  emerald: { chip: "border-emerald-100 bg-emerald-50 text-emerald-600", bar: "from-emerald-400 to-emerald-600" },
  blue: { chip: "border-blue-100 bg-blue-50 text-blue-600", bar: "from-blue-400 to-blue-600" },
  rose: { chip: "border-rose-100 bg-rose-50 text-rose-600", bar: "from-rose-400 to-rose-600" },
  amber: { chip: "border-amber-100 bg-amber-50 text-amber-600", bar: "from-amber-400 to-amber-600" },
  indigo: { chip: "border-indigo-100 bg-indigo-50 text-indigo-600", bar: "from-indigo-400 to-indigo-600" },
  orange: { chip: "border-orange-100 bg-orange-50 text-orange-600", bar: "from-orange-400 to-orange-600" },
  violet: { chip: "border-violet-100 bg-violet-50 text-violet-600", bar: "from-violet-400 to-violet-600" },
};

type KpiIconName = (typeof KPI_DEFS)[number]["icon"];

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function KpiIcon({ name }: { name: KpiIconName }) {
  const common = {
    className: "h-4 w-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
  };

  const paths: Record<KpiIconName, ReactNode> = {
    cash: (
      <>
        <rect x="3" y="7" width="18" height="10" rx="2" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M6.5 10v4M17.5 10v4" />
      </>
    ),
    bank: (
      <>
        <path d="M4 10h16M6 10v7M10 10v7M14 10v7M18 10v7M4 19h16" />
        <path d="m12 4 8 4H4l8-4Z" />
      </>
    ),
    arrowUp: (
      <>
        <path d="M7 17 17 7M10 7h7v7" />
        <path d="M5 19h14" />
      </>
    ),
    arrowDown: (
      <>
        <path d="m7 7 10 10M17 10v7h-7" />
        <path d="M5 19h14" />
      </>
    ),
    sale: (
      <>
        <path d="M6 7h12l-1 11H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </>
    ),
    receipt: (
      <>
        <path d="M7 4h10v16l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3V4Z" />
        <path d="M9.5 9h5M9.5 13h5" />
      </>
    ),
    calendar: (
      <>
        <rect x="5" y="5" width="14" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M5 10h14" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="surface-press flex w-full items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 text-left"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</p>
        <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
          {open ? "Hide" : "Show"}
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </span>
      </button>
      {open ? children : null}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="card rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-7 w-32 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
          </div>
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

      {data?.backup.needsFirstBackup ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <strong>Set up your first database backup.</strong>{" "}
          Schedule a backup when you are ready so your data can be restored if needed.{" "}
          <Link href="/database-backup" className="font-semibold underline">
            Open Database Backup
          </Link>
        </div>
      ) : null}

      {data?.backup.isStale ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Database backup overdue.</strong> Last backup was {data.backup.backupStaleDays} day(s) ago.
          Maintain a regular backup log in case of data loss.{" "}
          <Link href="/database-backup" className="font-semibold underline">
            Open Database Backup
          </Link>
        </div>
      ) : null}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-5">
          {KPI_DEFS.map((kpi) => {
            const tone = KPI_TONE[kpi.tone] ?? KPI_TONE.blue;
            return (
              <div
                key={kpi.key}
                className="card surface-press relative overflow-hidden rounded-xl p-4 pl-5 flex items-start justify-between gap-3"
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${tone.bar}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-800 tabular-nums leading-none">{fmt(data.kpis[kpi.key])}</p>
                </div>
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${tone.chip}`}
                  aria-hidden="true"
                >
                  <KpiIcon name={kpi.icon} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-2 mb-5">
        {data && data.bankPosition.length > 0 && (
          <CollapsibleSection title="Bank Position" defaultOpen>
            <div className="max-h-[520px] overflow-auto">
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
                    <tr key={b.id} className="accent-row-hover transition-colors">
                      <td className="px-4 py-2.5 text-slate-700 font-medium">
                        <Link
                          href={`/reports/general-ledger?accountId=${encodeURIComponent(b.accountId)}`}
                          className="accent-link hover:underline"
                        >
                          {b.name}
                        </Link>
                      </td>
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
          </CollapsibleSection>
        )}

        {data && (
          <CollapsibleSection title="Sale Stats" defaultOpen>
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
          </CollapsibleSection>
        )}
      </div>

      {data && data.currentStock.length > 0 && (
        <CollapsibleSection title="Current Stock" defaultOpen={false}>
          <div className="mb-5 max-h-[520px] overflow-auto">
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
                  <tr key={s.id} className="accent-row-hover transition-colors">
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
        </CollapsibleSection>
      )}

      <div className="card rounded-xl overflow-hidden">
        <div className="accent-section-header">
          <div className="accent-bar" />
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Quick Links</p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-4">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.label}
              onClick={() => router.push(link.href)}
              className="accent-tile surface-press rounded-lg px-3 py-2.5 text-left text-sm font-medium"
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
