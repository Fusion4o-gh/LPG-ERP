"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";

type AuditRow = Record<string, unknown>;

export function AuditLogViewer() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [filters, setFilters] = useState({ module: "", action: "", userId: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const data = await apiGet<{ logs: AuditRow[] }>(`/api/audit-logs?${params.toString()}`);
    setRows(data.logs);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    load().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }

  return (
    <>
      <PageHeader title="Audit Log" description="Review operational changes without exposing sensitive values." />
      <ApiError message={error} />
      <form onSubmit={submit} className="mb-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-5">
        <input placeholder="Module" value={filters.module} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Any Action</option>
          {["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "CLOSE_DAY"].map((action) => <option key={action} value={action}>{action}</option>)}
        </select>
        <input placeholder="User ID" value={filters.userId} onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Filter</button>
        </div>
      </form>
      <DataTable
        rows={rows}
        loading={loading}
        columns={[
          { key: "timestamp", label: "Timestamp" },
          { key: "user", label: "User" },
          { key: "module", label: "Module" },
          { key: "action", label: "Action" },
          { key: "recordReference", label: "Record" },
          { key: "beforeSummary", label: "Before" },
          { key: "afterSummary", label: "After" },
        ]}
      />
    </>
  );
}

