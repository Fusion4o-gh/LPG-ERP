"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/api-client";

type DailyActivityReport = {
  summary: {
    salesCount: number;
    purchaseCount: number;
    cylinderReturnsCount: number;
    cashVoucherCount: number;
    bankVoucherCount: number;
    stockMovements: number;
  };
  sales: Record<string, unknown>[];
  purchases: Record<string, unknown>[];
  cylinderReturns: Record<string, unknown>[];
  cashVouchers: Record<string, unknown>[];
  bankVouchers: Record<string, unknown>[];
  stockSummary: Record<string, unknown>[];
};

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

function SectionTable({
  title,
  rows,
  columns,
  loading,
}: {
  title: string;
  rows: Record<string, unknown>[];
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  loading: boolean;
}) {
  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      </div>
      <DataTable loading={loading} rows={rows} columns={columns} stickyHeader />
    </section>
  );
}

export function DailyActivityReportClient() {
  const [report, setReport] = useState<DailyActivityReport | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");

  function reportUrl(format?: "csv") {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    if (format) params.set("format", format);
    const query = params.toString();
    return query ? `/api/reports/daily-activity?${query}` : "/api/reports/daily-activity";
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<DailyActivityReport>(reportUrl());
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report load failed.");
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

  function printReport() {
    window.print();
  }

  const summary = report?.summary;
  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  return (
    <section data-report-print className="space-y-5">
      <div data-print-hidden>
        <PageHeader
          title="Daily Activity Report"
          description="Sectional operational activity for sales, purchases, returns, vouchers, and stock."
          actions={
            <>
              <a href={reportUrl("csv")} download className="btn-outline">
                CSV
              </a>
              <button type="button" onClick={printReport} className="btn-outline">
                Print
              </button>
            </>
          }
        />
      </div>

      <div className="hidden print:block" data-print-only>
        <h1 className="text-xl font-semibold text-slate-950">Daily Activity Report</h1>
        <p className="mt-1 text-sm text-slate-700">Sectional operational activity for sales, purchases, returns, vouchers, and stock.</p>
        <div className="mt-3 grid gap-1 text-xs text-slate-700">
          <div>Generated: {generatedAt || "Preparing..."}</div>
          <div>
            Filters:{" "}
            {activeFilters.length ? activeFilters.map(([key, value]) => `${key} ${value}`).join("; ") : "None"}
          </div>
        </div>
      </div>

      <form onSubmit={submit} data-print-hidden className="card rounded-xl p-4 grid gap-3 md:grid-cols-3 items-end">
        <div>
          <label className="form-label mb-1">From</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="form-input" />
        </div>
        <div>
          <label className="form-label mb-1">To</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="form-input" />
        </div>
        <div>
          <button type="submit" className="btn-primary w-full justify-center">
            Apply
          </button>
        </div>
      </form>

      <ApiError message={error} />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Sales", summary?.salesCount],
          ["Purchases", summary?.purchaseCount],
          ["Returns", summary?.cylinderReturnsCount],
          ["Cash Vouchers", summary?.cashVoucherCount],
          ["Bank Vouchers", summary?.bankVoucherCount],
          ["Stock Lines", summary?.stockMovements],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            <div className="mt-1 text-xl font-bold text-slate-800 tabular-nums">{loading ? "…" : (value ?? 0)}</div>
          </div>
        ))}
      </div>

      <SectionTable
        title="Sales"
        loading={loading}
        rows={report?.sales ?? []}
        columns={[
          { key: "documentNo", label: "Document" },
          { key: "transactionDate", label: "Date" },
          { key: "party", label: "Customer" },
          { key: "item", label: "Item" },
          { key: "cylinderState", label: "State" },
          { key: "quantity", label: "Qty" },
          { key: "direction", label: "Direction" },
        ]}
      />

      <SectionTable
        title="Purchases"
        loading={loading}
        rows={report?.purchases ?? []}
        columns={[
          { key: "documentNo", label: "Document" },
          { key: "transactionDate", label: "Date" },
          { key: "party", label: "Vendor" },
          { key: "item", label: "Item" },
          { key: "cylinderState", label: "State" },
          { key: "quantity", label: "Qty" },
          { key: "direction", label: "Direction" },
        ]}
      />

      <SectionTable
        title="Cylinder Returns"
        loading={loading}
        rows={report?.cylinderReturns ?? []}
        columns={[
          { key: "documentNo", label: "Document" },
          { key: "transactionDate", label: "Date" },
          { key: "party", label: "Customer" },
          { key: "item", label: "Item" },
          { key: "quantity", label: "Qty" },
        ]}
      />

      <SectionTable
        title="Cash Vouchers"
        loading={loading}
        rows={report?.cashVouchers ?? []}
        columns={[
          { key: "voucherNo", label: "Voucher" },
          { key: "voucherType", label: "Type" },
          { key: "transactionDate", label: "Date" },
          { key: "amount", label: "Amount", render: (row) => money(row.amount) },
          { key: "narration", label: "Narration" },
        ]}
      />

      <SectionTable
        title="Bank Vouchers"
        loading={loading}
        rows={report?.bankVouchers ?? []}
        columns={[
          { key: "voucherNo", label: "Voucher" },
          { key: "voucherType", label: "Type" },
          { key: "transactionDate", label: "Date" },
          { key: "amount", label: "Amount", render: (row) => money(row.amount) },
          { key: "narration", label: "Narration" },
        ]}
      />

      <SectionTable
        title="Stock Summary"
        loading={loading}
        rows={(report?.stockSummary ?? []) as Record<string, unknown>[]}
        columns={[
          { key: "itemCode", label: "Item Code", render: (row) => String((row.item as { code?: string })?.code ?? "") },
          { key: "itemName", label: "Item Name", render: (row) => String((row.item as { name?: string })?.name ?? "") },
          { key: "filledQuantity", label: "Filled" },
          { key: "emptyQuantity", label: "Empty" },
          { key: "netMovement", label: "Net" },
        ]}
      />
    </section>
  );
}
