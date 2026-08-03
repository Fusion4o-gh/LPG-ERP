"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";

export function VoucherListPageClient() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", voucherType: "", search: "" });

  async function load() {
    setLoading(true);
    setError("");
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    apiGet<{ vouchers: Record<string, unknown>[] }>(query.toString() ? `/api/accounting/vouchers?${query}` : "/api/accounting/vouchers")
      .then((data) => setRows(data.vouchers))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  function reportUrl(format?: string) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    if (format) query.set("format", format);
    return `/api/accounting/vouchers?${query}`;
  }

  return (
    <>
      <PageHeader title="Voucher List" description="Accounting vouchers created by operational transactions." actions={<><a href={reportUrl("csv")} className="btn-secondary" data-print-hidden>Download CSV</a><button type="button" onClick={() => window.print()} className="btn-secondary" data-print-hidden>Print</button></>} />
      <form onSubmit={submit} className="card rounded-xl p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5 items-end">
        <div><label className="form-label mb-1">From</label><input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="form-input" /></div>
        <div><label className="form-label mb-1">To</label><input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="form-input" /></div>
        <div><label className="form-label mb-1">Voucher Type</label><select value={filters.voucherType} onChange={(event) => setFilters((current) => ({ ...current, voucherType: event.target.value }))} className="form-input"><option value="">All Types</option><option value="CR">Cash Receipt</option><option value="CP">Cash Payment</option><option value="BR">Bank Receipt</option><option value="BP">Bank Payment</option><option value="JV">Journal</option><option value="SR">Sale</option><option value="PV">Purchase</option></select></div>
        <div><label className="form-label mb-1">Search</label><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Voucher or document no." className="form-input" /></div>
        <button type="submit" className="btn-primary">Search</button>
      </form>
      <ApiError message={error} />
      <section data-report-print>
      <DataTable
        loading={loading}
        rows={rows}
        enableControls
        columns={[
          { key: "voucherNo", label: "Voucher No", render: (row) => <Link className="font-semibold text-slate-950 underline" href={`/accounting/vouchers/${row.id}`}>{String(row.voucherNo)}</Link> },
          { key: "voucherType", label: "Type" },
          { key: "voucherDate", label: "Date", render: (row) => String(row.voucherDate).slice(0, 10) },
          { key: "total", label: "Total" },
          { key: "balanceStatus", label: "Status" },
        ]}
      />
      </section>
    </>
  );
}
