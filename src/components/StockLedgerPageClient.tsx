"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";

export function StockLedgerPageClient() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [filters, setFilters] = useState({ itemId: "", from: "", to: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const data = await apiGet<{ entries: Record<string, unknown>[] }>(`/api/stock-ledger?${params}`);
      setRows(data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiGet<{ items: Record<string, unknown>[] }>("/api/items").then((data) => setItems(data.items)).catch((err: Error) => setError(err.message));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  return (
    <>
      <PageHeader title="Stock Ledger" description="Immutable filled and empty cylinder movements by item, date, and source document number." />
      <form onSubmit={submit} className="mb-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-4">
        <select value={filters.itemId} onChange={(event) => setFilters((current) => ({ ...current, itemId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2">
          <option value="">All Items</option>
          {items.map((item) => (
            <option key={String(item.id)} value={String(item.id)}>
              {[item.code, item.name].filter(Boolean).join(" - ")}
            </option>
          ))}
        </select>
        <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2" />
        <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2" />
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
      </form>
      <ApiError message={error} />
      <DataTable
        loading={loading}
        rows={rows}
        columns={[
          { key: "date", label: "Date", render: (row) => String(row.date).slice(0, 10) },
          { key: "item", label: "Item", render: (row) => `${(row.item as { code?: string; name?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}` },
          { key: "cylinderState", label: "State" },
          { key: "direction", label: "In/Out" },
          { key: "quantity", label: "Qty" },
          { key: "balanceAfter", label: "Balance" },
          { key: "sourceDocumentNo", label: "Source Document" },
        ]}
      />
    </>
  );
}
