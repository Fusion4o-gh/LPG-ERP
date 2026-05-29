"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/api-client";

type Mode = "invoice" | "item" | "type";
type Lookup = { id: string; code?: string; name: string };
type Column = { key: string; label: string };

const MODE_COLUMNS: Record<Mode, Column[]> = {
  invoice: [
    { key: "issueNo", label: "Issue No" },
    { key: "transactionDate", label: "Date" },
    { key: "customerCode", label: "Customer Code" },
    { key: "customerName", label: "Customer Name" },
    { key: "totalQty", label: "Qty" },
    { key: "saleAmount", label: "Amount" },
    { key: "saleType", label: "Sale Type" },
  ],
  item: [
    { key: "issueNo", label: "Issue No" },
    { key: "transactionDate", label: "Date" },
    { key: "customerCode", label: "Customer Code" },
    { key: "customerName", label: "Customer Name" },
    { key: "itemCode", label: "Item Code" },
    { key: "itemName", label: "Item Name" },
    { key: "totalQty", label: "Qty" },
    { key: "saleAmount", label: "Amount" },
  ],
  type: [
    { key: "saleType", label: "Sale Type" },
    { key: "invoiceCount", label: "Invoices" },
    { key: "totalQty", label: "Qty" },
    { key: "saleAmount", label: "Amount" },
  ],
};

export default function SaleBetweenDatesReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [mode, setMode] = useState<Mode>("invoice");
  const [filters, setFilters] = useState({ from: "", to: "", itemId: "", customerId: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const columns = useMemo(() => MODE_COLUMNS[mode], [mode]);

  function reportUrl(format?: "csv") {
    const params = new URLSearchParams(Object.entries({ ...filters, mode }).filter(([, value]) => value));
    if (format) params.set("format", format);
    return `/api/reports/sale-between-dates?${params}`;
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
    Promise.all([
      apiGet<{ items: Lookup[] }>("/api/items"),
      apiGet<{ customers: Lookup[] }>("/api/customers"),
    ])
      .then(([itemData, customerData]) => {
        setItems(itemData.items);
        setCustomers(customerData.customers);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  return (
    <section>
      <PageHeader
        title="Sale B/W Date"
        description="Sales between dates — invoice-wise, item-wise, or grouped by sale type."
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

      <form onSubmit={submit} className="card rounded-xl mb-4 p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end">
        <div>
          <label className="form-label mb-1">Report Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="form-input">
            <option value="invoice">Invoice-wise</option>
            <option value="item">Item-wise</option>
            <option value="type">Type-wise</option>
          </select>
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
          <label className="form-label mb-1">Item</label>
          <select value={filters.itemId} onChange={(e) => setFilters((f) => ({ ...f, itemId: e.target.value }))} className="form-input">
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.code, item.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label mb-1">Customer</label>
          <select value={filters.customerId} onChange={(e) => setFilters((f) => ({ ...f, customerId: e.target.value }))} className="form-input">
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.code, c.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Generate
        </button>
      </form>

      <ApiError message={error} />
      <DataTable columns={columns} rows={rows} loading={loading} />
    </section>
  );
}
