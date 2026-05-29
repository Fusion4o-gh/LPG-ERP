"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/api-client";

function money(value: unknown) {
  return Number(value ?? 0).toFixed(2);
}

export default function GroupSummaryReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", groupName: "Trade" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function reportUrl(format?: "csv") {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    if (format) params.set("format", format);
    const query = params.toString();
    return query ? `/api/reports/group-summary?${query}` : "/api/reports/group-summary";
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ rows: Record<string, unknown>[] }>(reportUrl());
      setRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  return (
    <section data-report-print>
      <PageHeader
        title="Group Summary"
        description="Roll up debits, credits, and balances for a control account group and its descendants."
        actions={
          <a href={reportUrl("csv")} download className="btn-outline">
            CSV
          </a>
        }
      />
      <form onSubmit={submit} className="card rounded-xl mb-4 p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4 items-end">
        <div>
          <label className="form-label mb-1">Group Name</label>
          <input
            type="text"
            value={filters.groupName}
            onChange={(e) => setFilters((f) => ({ ...f, groupName: e.target.value }))}
            className="form-input"
            placeholder="e.g. Trade Debtors"
          />
        </div>
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
      <DataTable
        loading={loading}
        rows={rows}
        columns={[
          { key: "groupCode", label: "Group Code" },
          { key: "groupName", label: "Group Name" },
          { key: "accountType", label: "Type" },
          { key: "accountCount", label: "Accounts" },
          { key: "periodDebit", label: "Period Debit", render: (row) => money(row.periodDebit) },
          { key: "periodCredit", label: "Period Credit", render: (row) => money(row.periodCredit) },
          { key: "balance", label: "Balance", render: (row) => money(row.balance) },
        ]}
        stickyHeader
      />
    </section>
  );
}
