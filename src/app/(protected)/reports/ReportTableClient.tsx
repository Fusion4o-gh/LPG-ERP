"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/components/ApiError";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/api-client";

type Column = { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode };
type Lookup = { id: string; code?: string; name: string; loginId?: string };
type SummaryField = { key: string; label: string; format?: (value: unknown) => React.ReactNode };

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function filterLabel(key: string) {
  const labels: Record<string, string> = {
    from: "From",
    to: "To",
    asOf: "As of",
    itemId: "Item",
    categoryId: "Category",
    customerId: "Customer",
    vendorId: "Vendor",
    accountId: "Account",
    accountType: "Account Type",
    level: "Level",
    productId: "Product",
    locationId: "Location",
    importType: "Import Type",
    vehicleId: "Vehicle",
    transporterId: "Transporter",
  };
  return labels[key] ?? key;
}

export function ReportTableClient({
  title,
  description,
  endpoint,
  dataKey,
  columns,
  summaryFields = [],
  showItemFilter = false,
  showCategoryFilter = false,
  showCustomerFilter = false,
  showVendorFilter = false,
  showAccountFilter = false,
  showAccountMultiFilter = false,
  showAccountSlotsFilter = false,
  showVoucherTypeFilter = false,
  showReportUserFilter = false,
  showVoucherRangeFilter = false,
  accountFilterLabel = "Default Cash Account",
  showBankFilter = false,
  showAccountTypeFilter = false,
  showAccountLevelFilter = false,
  showAsOfFilter = false,
  showDateFilter = true,
  showBulkProductFilter = false,
  showLocationFilter = false,
  showVehicleFilter = false,
  showTransporterFilter = false,
  showImportTypeFilter = false,
  enableCsv = true,
}: {
  title: string;
  description: string;
  endpoint: string;
  dataKey: string;
  columns: Column[];
  summaryFields?: SummaryField[];
  showItemFilter?: boolean;
  showCategoryFilter?: boolean;
  showCustomerFilter?: boolean;
  showVendorFilter?: boolean;
  showAccountFilter?: boolean;
  showAccountMultiFilter?: boolean;
  showAccountSlotsFilter?: boolean;
  showVoucherTypeFilter?: boolean;
  showReportUserFilter?: boolean;
  showVoucherRangeFilter?: boolean;
  accountFilterLabel?: string;
  showBankFilter?: boolean;
  showAccountTypeFilter?: boolean;
  showAccountLevelFilter?: boolean;
  showAsOfFilter?: boolean;
  showDateFilter?: boolean;
  showBulkProductFilter?: boolean;
  showLocationFilter?: boolean;
  showVehicleFilter?: boolean;
  showTransporterFilter?: boolean;
  showImportTypeFilter?: boolean;
  enableCsv?: boolean;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [items, setItems] = useState<Lookup[]>([]);
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [accounts, setAccounts] = useState<Lookup[]>([]);
  const [reportUsers, setReportUsers] = useState<Lookup[]>([]);
  const [banks, setBanks] = useState<Lookup[]>([]);
  const [bulkProducts, setBulkProducts] = useState<Lookup[]>([]);
  const [locations, setLocations] = useState<Lookup[]>([]);
  const [vehicles, setVehicles] = useState<Lookup[]>([]);
  const [transporters, setTransporters] = useState<Lookup[]>([]);
  const [filters, setFilters] = useState({ from: todayIso(), to: todayIso(), asOf: "", itemId: "", categoryId: "", customerId: "", vendorId: "", accountId: "", accountIds: "", bankId: "", accountType: "", level: "", productId: "", locationId: "", importType: "", vehicleId: "", transporterId: "", voucherType: "", userId: "", voucherFrom: "", voucherTo: "" });
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [rangeMode, setRangeMode] = useState<"date" | "voucher">("date");

  function reportUrl(format?: "csv", filterValues = filters) {
    const params = new URLSearchParams(Object.entries(filterValues).filter(([key, value]) => value && (showDateFilter || (key !== "from" && key !== "to"))));
    if (format) params.set("format", format);
    const query = params.toString();
    return query ? `${endpoint}?${query}` : endpoint;
  }

  async function load(filterValues = filters) {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<Record<string, unknown>>(reportUrl(undefined, filterValues));
      setRows(Array.isArray(data[dataKey]) ? (data[dataKey] as Record<string, unknown>[]) : []);
      setSummary(data);
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
    const from = showDateFilter ? params.get("from") : null;
    const to = showDateFilter ? params.get("to") : null;
    const initialFilters = {
      ...filters,
      ...(accountId ? { accountId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
    if (accountId || from || to) setFilters(initialFilters);
    if (showItemFilter) apiGet<{ items: Lookup[] }>("/api/items").then((data) => setItems(data.items)).catch((err: Error) => setError(err.message));
    if (showCategoryFilter) apiGet<{ categories: Lookup[] }>("/api/configuration/category-coding").then((data) => setCategories(data.categories)).catch((err: Error) => setError(err.message));
    if (showCustomerFilter) apiGet<{ customers: Lookup[] }>("/api/customers").then((data) => setCustomers(data.customers)).catch((err: Error) => setError(err.message));
    if (showVendorFilter) apiGet<{ vendors: Lookup[] }>("/api/vendors").then((data) => setVendors(data.vendors)).catch((err: Error) => setError(err.message));
    if (showAccountFilter || showAccountMultiFilter) apiGet<{ accounts: Lookup[] }>("/api/chart-of-accounts").then((data) => setAccounts(data.accounts)).catch((err: Error) => setError(err.message));
    if (showReportUserFilter) apiGet<{ users: Lookup[] }>("/api/reports/users").then((data) => setReportUsers(data.users)).catch((err: Error) => setError(err.message));
    if (showBankFilter) apiGet<{ banks: Lookup[] }>("/api/banks").then((data) => setBanks(data.banks)).catch((err: Error) => setError(err.message));
    if (showBulkProductFilter) apiGet<{ bulkProducts: Lookup[] }>("/api/configuration/bulk-products").then((data) => setBulkProducts(data.bulkProducts)).catch((err: Error) => setError(err.message));
    if (showLocationFilter) apiGet<{ stockLocations: Lookup[] }>("/api/configuration/stock-locations").then((data) => setLocations(data.stockLocations)).catch((err: Error) => setError(err.message));
    if (showVehicleFilter) apiGet<{ vehicles: Lookup[] }>("/api/configuration/vehicles").then((data) => setVehicles(data.vehicles)).catch((err: Error) => setError(err.message));
    if (showTransporterFilter) apiGet<{ transporters: Lookup[] }>("/api/configuration/transporters").then((data) => setTransporters(data.transporters)).catch((err: Error) => setError(err.message));
    load(initialFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [rows, search]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const firstRow = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, filteredRows.length);

  function printReport() {
    window.print();
  }

  const activeFilters = Object.entries(filters).filter(([key, value]) => value && (showDateFilter || (key !== "from" && key !== "to")));

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
      <form onSubmit={submit} data-print-hidden className="card mb-3 overflow-hidden">
        <div className="accent-section-header">
          <div className="accent-bar" />
          <p className="text-xs font-semibold uppercase tracking-widest text-steel-600">Filters</p>
        </div>
        <div className="grid items-end gap-2.5 p-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
        {showAccountLevelFilter && (
          <div>
            <label className="form-label mb-1">Level</label>
            <select value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} className={selectCls}>
              <option value="">All Levels</option>
              <option value="1">Level A</option>
              <option value="2">Level B</option>
              <option value="3">Level C</option>
              <option value="4">Level D</option>
            </select>
          </div>
        )}
        {showCategoryFilter && (
          <div>
            <label className="form-label mb-1">Category</label>
            <select value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))} className={selectCls}>
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
        )}
        {showAccountMultiFilter && (
          <div>
            <label className="form-label mb-1">Accounts</label>
            <select multiple value={filters.accountIds ? filters.accountIds.split(",").filter(Boolean) : []} onChange={(e) => setFilters((f) => ({ ...f, accountIds: Array.from(e.target.selectedOptions).map((option) => option.value).join(",") }))} className={selectCls} size={Math.min(6, Math.max(3, accounts.length))}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{[a.code, a.name].filter(Boolean).join(" - ")}</option>)}
            </select>
            <p className="mt-1 text-xs text-steel-500">Use Ctrl/Cmd to select multiple accounts.</p>
          </div>
        )}
        {showAccountSlotsFilter && (
          <>
            {Array.from({ length: 5 }, (_, index) => {
              const selected = filters.accountIds.split(",").slice(0, 5);
              return (
                <div key={`account-slot-${index}`}>
                  <label className="form-label mb-1">A/C Title ({index + 1})</label>
                  <select
                    value={selected[index] ?? ""}
                    onChange={(event) => {
                      const next = [...selected, "", "", "", ""].slice(0, 5);
                      next[index] = event.target.value;
                      setFilters((f) => ({ ...f, accountIds: next.join(",") }));
                    }}
                    className={selectCls}
                  >
                    <option value="">Choose an account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{[account.code, account.name].filter(Boolean).join(" - ")}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </>
        )}
        {showVoucherTypeFilter && (
          <div>
            <label className="form-label mb-1">Voucher Type</label>
            <select value={filters.voucherType} onChange={(e) => setFilters((f) => ({ ...f, voucherType: e.target.value }))} className={selectCls}>
              <option value="">All Voucher Types</option><option value="JV">JV</option><option value="BP">BP</option><option value="BR">BR</option><option value="CP">CP</option><option value="CR">CR</option><option value="JVD">JVD</option><option value="JVM">JVM</option><option value="HDP">HDP</option>
            </select>
          </div>
        )}
        {showReportUserFilter && (
          <div>
            <label className="form-label mb-1">User</label>
            <select value={filters.userId} onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))} className={selectCls}>
              <option value="">All Users</option>{reportUsers.map((user) => <option key={user.id} value={user.id}>{[user.name, user.loginId].filter(Boolean).join(" - ")}</option>)}
            </select>
          </div>
        )}
        {showBulkProductFilter && (
          <div>
            <label className="form-label mb-1">Product</label>
            <select value={filters.productId} onChange={(e) => setFilters((f) => ({ ...f, productId: e.target.value }))} className={selectCls}>
              <option value="">All Products</option>
              {bulkProducts.map((product) => <option key={product.id} value={product.id}>{[product.code, product.name].filter(Boolean).join(" - ")}</option>)}
            </select>
          </div>
        )}
        {showLocationFilter && (
          <div>
            <label className="form-label mb-1">Location</label>
            <select value={filters.locationId} onChange={(e) => setFilters((f) => ({ ...f, locationId: e.target.value }))} className={selectCls}>
              <option value="">All Locations</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{[location.code, location.name].filter(Boolean).join(" - ")}</option>)}
            </select>
          </div>
        )}
        {showImportTypeFilter && (
          <div>
            <label className="form-label mb-1">Import Type</label>
            <select value={filters.importType} onChange={(e) => setFilters((f) => ({ ...f, importType: e.target.value }))} className={selectCls}>
              <option value="">All Import Types</option>
              <option value="TAFTAN">Taftan</option>
              <option value="SHIP">Ship</option>
            </select>
          </div>
        )}
        {showVehicleFilter && (
          <div>
            <label className="form-label mb-1">Vehicle</label>
            <select value={filters.vehicleId} onChange={(e) => setFilters((f) => ({ ...f, vehicleId: e.target.value }))} className={selectCls}>
              <option value="">All Vehicles</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.code, vehicle.name].filter(Boolean).join(" - ")}</option>)}
            </select>
          </div>
        )}
        {showTransporterFilter && (
          <div>
            <label className="form-label mb-1">Transporter</label>
            <select value={filters.transporterId} onChange={(e) => setFilters((f) => ({ ...f, transporterId: e.target.value }))} className={selectCls}>
              <option value="">All Transporters</option>
              {transporters.map((transporter) => <option key={transporter.id} value={transporter.id}>{[transporter.code, transporter.name].filter(Boolean).join(" - ")}</option>)}
            </select>
          </div>
        )}
        {showVoucherRangeFilter && (
          <>
            <div className="flex items-center gap-4 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name={`${endpoint}-range-mode`} checked={rangeMode === "date"} onChange={() => { setRangeMode("date"); setFilters((f) => ({ ...f, voucherFrom: "", voucherTo: "" })); }} />Date to Date</label>
              <label className="flex items-center gap-2"><input type="radio" name={`${endpoint}-range-mode`} checked={rangeMode === "voucher"} onChange={() => { setRangeMode("voucher"); setFilters((f) => ({ ...f, from: "", to: "" })); }} />Voucher to Voucher</label>
            </div>
            {rangeMode === "voucher" ? <>
            <div><label className="form-label mb-1">From Voucher</label><input value={filters.voucherFrom} onChange={(e) => setFilters((f) => ({ ...f, voucherFrom: e.target.value }))} className={inputCls} placeholder="Voucher number" /></div>
            <div><label className="form-label mb-1">To Voucher</label><input value={filters.voucherTo} onChange={(e) => setFilters((f) => ({ ...f, voucherTo: e.target.value }))} className={inputCls} placeholder="Voucher number" /></div>
            </> : null}
          </>
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
            {showDateFilter && (rangeMode === "date" || !showVoucherRangeFilter) ? <><div>
              <label className="form-label mb-1">From</label>
              <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="form-label mb-1">To</label>
              <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className={inputCls} />
            </div></> : null}
          </>
        )}
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full justify-center">
            Apply
          </button>
        </div>
        </div>
      </form>

      <ApiError message={error} />
      {summaryFields.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:break-inside-avoid">
          {summaryFields.map((field) => (
            <div key={field.key} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel-500">{field.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {loading ? "…" : field.format ? field.format(summary[field.key]) : String(summary[field.key] ?? "0")}
              </div>
            </div>
          ))}
        </div>
      )}
      <div data-print-hidden className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--surface-border)] bg-white px-3 py-2 text-sm text-steel-600">
        <label className="flex items-center gap-2"><span>Display</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="form-input py-1.5">{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select><span>records</span></label>
        <span>Showing {firstRow} to {lastRow} of {filteredRows.length} entries</span>
        <label className="flex items-center gap-2"><span>Search:</span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="form-input py-1.5" placeholder="Search report" /></label>
        <div className="flex items-center gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="btn-outline px-2 py-1 disabled:opacity-40">Previous</button><span className="px-2">{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="btn-outline px-2 py-1 disabled:opacity-40">Next</button></div>
      </div>
      <div data-print-hidden><DataTable loading={loading} rows={visibleRows} columns={columns} stickyHeader /></div>
      <div className="hidden print:block"><DataTable loading={loading} rows={rows} columns={columns} /></div>
    </section>
  );
}
