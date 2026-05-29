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
  accountFilterLabel = "Default Cash Account",
  showBankFilter = false,
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
  accountFilterLabel?: string;
  showBankFilter?: boolean;
  showAccountTypeFilter?: boolean;
  showAsOfFilter?: boolean;
  enableCsv?: boolean;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [accounts, setAccounts] = useState<Lookup[]>([]);
  const [banks, setBanks] = useState<Lookup[]>([]);
  const [filters, setFilters] = useState({ from: "", to: "", asOf: "", itemId: "", customerId: "", vendorId: "", accountId: "", bankId: "", accountType: "" });
  const [generatedAt, setGeneratedAt] = useState("");
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
    setGeneratedAt(new Date().toLocaleString());
    const params = new URLSearchParams(window.location.search);
    const accountId = params.get("accountId");
    const from = params.get("from");
    const to = params.get("to");
    if (accountId || from || to) {
      setFilters((current) => ({
        ...current,
        ...(accountId ? { accountId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }));
    }
    if (showItemFilter) apiGet<{ items: Lookup[] }>("/api/items").then((data) => setItems(data.items)).catch((err: Error) => setError(err.message));
    if (showCustomerFilter) apiGet<{ customers: Lookup[] }>("/api/customers").then((data) => setCustomers(data.customers)).catch((err: Error) => setError(err.message));
    if (showVendorFilter) apiGet<{ vendors: Lookup[] }>("/api/vendors").then((data) => setVendors(data.vendors)).catch((err: Error) => setError(err.message));
    if (showAccountFilter) apiGet<{ accounts: Lookup[] }>("/api/chart-of-accounts").then((data) => setAccounts(data.accounts)).catch((err: Error) => setError(err.message));
    if (showBankFilter) apiGet<{ banks: Lookup[] }>("/api/banks").then((data) => setBanks(data.banks)).catch((err: Error) => setError(err.message));
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

  const selectCls = "form-input";
  const inputCls = "form-input";

  return (
    <section data-report-print>
      <div data-print-hidden>
        <PageHeader
          title={title}
          description={description}
          actions={
            <>
              {enableCsv && (
                <a
                  href={reportUrl("csv")}
                  download
                  className="btn-outline"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </a>
              )}
              <button type="button" onClick={printReport} className="btn-outline">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </>
          }
        />
      </div>

      {/* Print-only header */}
      <div className="hidden print:block" data-print-only>
        <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-700">{description}</p>
        <div className="mt-3 grid gap-1 text-xs text-slate-700">
          <div>Generated: {generatedAt || "Preparing..."}</div>
          <div>
            Filters:{" "}
            {activeFilters.length
              ? activeFilters.map(([key, value]) => `${filterLabel(key)} ${value}`).join("; ")
              : "None"}
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <form
        onSubmit={submit}
        data-print-hidden
        className="card rounded-xl mb-4 p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 items-end"
      >
        {showItemFilter && (
          <div>
            <label className="form-label mb-1">Item</label>
            <select value={filters.itemId} onChange={(e) => setFilters((f) => ({ ...f, itemId: e.target.value }))} className={selectCls}>
              <option value="">All Items</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{[item.code, item.name].filter(Boolean).join(" - ")}</option>
              ))}
            </select>
          </div>
        )}
        {showCustomerFilter && (
          <div>
            <label className="form-label mb-1">Customer</label>
            <select value={filters.customerId} onChange={(e) => setFilters((f) => ({ ...f, customerId: e.target.value }))} className={selectCls}>
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{[c.code, c.name].filter(Boolean).join(" - ")}</option>
              ))}
            </select>
          </div>
        )}
        {showVendorFilter && (
          <div>
            <label className="form-label mb-1">Vendor</label>
            <select value={filters.vendorId} onChange={(e) => setFilters((f) => ({ ...f, vendorId: e.target.value }))} className={selectCls}>
              <option value="">Select Vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{[v.code, v.name].filter(Boolean).join(" - ")}</option>
              ))}
            </select>
          </div>
        )}
        {showAccountFilter && (
          <div>
            <label className="form-label mb-1">{accountFilterLabel}</label>
            <select value={filters.accountId} onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))} className={selectCls}>
              <option value="">{accountFilterLabel}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{[a.code, a.name].filter(Boolean).join(" - ")}</option>
              ))}
            </select>
          </div>
        )}
        {showBankFilter && (
          <div>
            <label className="form-label mb-1">Bank</label>
            <select value={filters.bankId} onChange={(e) => setFilters((f) => ({ ...f, bankId: e.target.value }))} className={selectCls}>
              <option value="">Select Bank</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        {showAccountTypeFilter && (
          <div>
            <label className="form-label mb-1">Account Type</label>
            <select value={filters.accountType} onChange={(e) => setFilters((f) => ({ ...f, accountType: e.target.value }))} className={selectCls}>
              <option value="">All Account Types</option>
              <option value="ASSET">Assets</option>
              <option value="LIABILITY">Liabilities</option>
              <option value="EQUITY">Equity</option>
              <option value="REVENUE">Revenue</option>
              <option value="EXPENSE">Expenses</option>
            </select>
          </div>
        )}
        {showAsOfFilter ? (
          <div>
            <label className="form-label mb-1">As of Date</label>
            <input
              type="date"
              aria-label="As of date"
              value={filters.asOf}
              onChange={(e) => setFilters((f) => ({ ...f, asOf: e.target.value }))}
              className={inputCls}
            />
          </div>
        ) : (
          <>
            <div>
              <label className="form-label mb-1">From</label>
              <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="form-label mb-1">To</label>
              <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={inputCls} />
            </div>
          </>
        )}
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full justify-center">
            Apply
          </button>
        </div>
      </form>

      <ApiError message={error} />
      <DataTable loading={loading} rows={rows} columns={columns} stickyHeader />
    </section>
  );
}
