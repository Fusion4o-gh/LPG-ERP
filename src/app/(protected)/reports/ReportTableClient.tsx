"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/api-client";

type Column = { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode };
type Lookup = { id: string; code?: string; name: string };

function filterLabel(key: string) {
  const labels: Record<string, string> = {
    from: "From",
    to: "To",
    asOf: "As of",
    itemId: "Item",
    customerId: "Customer",
    vendorId: "Vendor",
    accountId: "Account",
    accountType: "Account Type",
  };
  return labels[key] ?? key;
}

export function ReportTableClient({
  title,
  description,
  endpoint,
  dataKey,
  columns,
  showItemFilter = false,
  showCustomerFilter = false,
  showVendorFilter = false,
  showAccountFilter = false,
  showAccountTypeFilter = false,
  showAsOfFilter = false,
  enableCsv = true,
}: {
  title: string;
  description: string;
  endpoint: string;
  dataKey: string;
  columns: Column[];
  showItemFilter?: boolean;
  showCustomerFilter?: boolean;
  showVendorFilter?: boolean;
  showAccountFilter?: boolean;
  showAccountTypeFilter?: boolean;
  showAsOfFilter?: boolean;
  enableCsv?: boolean;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [accounts, setAccounts] = useState<Lookup[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", asOf: "", itemId: "", customerId: "", vendorId: "", accountId: "", accountType: "" });
  const [generatedAt] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function reportUrl(format?: "csv") {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    if (format) params.set("format", format);
    const query = params.toString();
    return query ? `${endpoint}?${query}` : endpoint;
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<Record<string, Record<string, unknown>[]>>(reportUrl());
      setRows(data[dataKey] ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (showItemFilter) apiGet<{ items: Lookup[] }>("/api/items").then((data) => setItems(data.items)).catch((err: Error) => setError(err.message));
    if (showCustomerFilter) apiGet<{ customers: Lookup[] }>("/api/customers").then((data) => setCustomers(data.customers)).catch((err: Error) => setError(err.message));
    if (showVendorFilter) apiGet<{ vendors: Lookup[] }>("/api/vendors").then((data) => setVendors(data.vendors)).catch((err: Error) => setError(err.message));
    if (showAccountFilter) apiGet<{ accounts: Lookup[] }>("/api/chart-of-accounts").then((data) => setAccounts(data.accounts)).catch((err: Error) => setError(err.message));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  function printReport() {
    window.print();
  }

  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  return (
    <section data-report-print>
      <div data-print-hidden>
        <PageHeader title={title} description={description} />
      </div>
      <div className="hidden print:block" data-print-only>
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-700">{description}</p>
        <div className="mt-3 grid gap-1 text-xs text-slate-700">
          <div>Generated: {generatedAt.toLocaleString()}</div>
          <div>
            Filters:{" "}
            {activeFilters.length
              ? activeFilters.map(([key, value]) => `${filterLabel(key)} ${value}`).join("; ")
              : "None"}
          </div>
        </div>
      </div>
      <form onSubmit={submit} data-print-hidden className="mb-4 grid gap-3 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-5">
        {showItemFilter ? (
          <select value={filters.itemId} onChange={(event) => setFilters((current) => ({ ...current, itemId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">All Items</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.code, item.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        ) : null}
        {showCustomerFilter ? (
          <select value={filters.customerId} onChange={(event) => setFilters((current) => ({ ...current, customerId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">All Customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {[customer.code, customer.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        ) : null}
        {showVendorFilter ? (
          <select value={filters.vendorId} onChange={(event) => setFilters((current) => ({ ...current, vendorId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">Select Vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {[vendor.code, vendor.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        ) : null}
        {showAccountFilter ? (
          <select value={filters.accountId} onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">Default Cash Account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {[account.code, account.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
        ) : null}
        {showAccountTypeFilter ? (
          <select value={filters.accountType} onChange={(event) => setFilters((current) => ({ ...current, accountType: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">All Account Types</option>
            <option value="ASSET">Assets</option>
            <option value="LIABILITY">Liabilities</option>
            <option value="EQUITY">Equity</option>
            <option value="REVENUE">Revenue</option>
            <option value="EXPENSE">Expenses</option>
          </select>
        ) : null}
        {showAsOfFilter ? (
          <input
            type="date"
            aria-label="As of date"
            value={filters.asOf}
            onChange={(event) => setFilters((current) => ({ ...current, asOf: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        ) : (
          <>
            <input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2" />
            <input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} className="rounded-md border border-slate-300 px-3 py-2" />
          </>
        )}
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply Filters</button>
        {enableCsv ? (
          <a href={reportUrl("csv")} download className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700">
            Download CSV
          </a>
        ) : null}
        <button type="button" onClick={printReport} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Print
        </button>
      </form>
      <ApiError message={error} />
      <DataTable loading={loading} rows={rows} columns={columns} />
    </section>
  );
}
