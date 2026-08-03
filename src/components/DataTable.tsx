"use client";

import { useEffect, useMemo, useState } from "react";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

function isNumericColumn(label: string) {
  return /(amount|balance|cash|count|credit|debit|empty|filled|movement|payable|quantity|receivable|stock|total)/i.test(label);
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  loading,
  stickyHeader,
  enableControls = false,
  searchPlaceholder = "Search...",
}: {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  stickyHeader?: boolean;
  enableControls?: boolean;
  searchPlaceholder?: string;
}) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => Object.values(row).some((value) => typeof value !== "object" && String(value ?? "").toLowerCase().includes(term)));
  }, [rows, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = enableControls ? filteredRows.slice((page - 1) * pageSize, page * pageSize) : rows;

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, rows.length]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function controls() {
    if (!enableControls) return null;
    const first = filteredRows.length === 0 ? 0 : (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, filteredRows.length);
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--surface-border)] bg-slate-50 px-3 py-2 text-xs text-steel-500">
        <label className="flex items-center gap-2">
          <span>Search:</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className="form-input !h-8 !w-48 !py-1 text-xs" />
        </label>
        <label className="flex items-center gap-2">
          <span>Display</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="form-select !h-8 !w-20 !py-1 text-xs">
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>records</span>
        </label>
        <span>Showing {first} to {last} of {filteredRows.length} entries</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="btn-outline !px-2 !py-1 !text-xs">Previous</button>
          <span className="px-1">{page} / {pageCount}</span>
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount} className="btn-outline !px-2 !py-1 !text-xs">Next</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="report-table-head">
                {columns.map((column, columnIndex) => (
                  <th
                    key={`${String(column.key)}-${columnIndex}`}
                    className={`whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-wide text-steel-500 ${
                      isNumericColumn(column.label) ? "text-right" : "text-left"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--surface-border)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((column, columnIndex) => (
                    <td key={`${String(column.key)}-${columnIndex}`} className="px-3 py-2">
                      <div
                        className="h-3 rounded bg-steel-100"
                        style={{
                          width: isNumericColumn(column.label) ? "60%" : "80%",
                          marginLeft: isNumericColumn(column.label) ? "auto" : undefined,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {controls()}
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-full border-collapse text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
            <tr className="report-table-head">
              {columns.map((column, columnIndex) => (
                <th
                  key={`${String(column.key)}-${columnIndex}`}
                  className={`whitespace-nowrap px-3 py-2 text-xs font-bold uppercase tracking-wide text-steel-500 ${
                    isNumericColumn(column.label) ? "text-right" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--surface-border)] bg-white">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center" colSpan={columns.length}>
                  <div className="flex flex-col items-center gap-1.5">
                    <svg className="h-8 w-8 text-steel-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-bold text-steel-400">No records found</p>
                    <p className="text-xs text-steel-300">Adjust your filters or add new data</p>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr
                  key={String(row.id ?? index)}
                  className="accent-row-hover table-row-interactive"
                  style={index % 2 === 0 ? { background: "#ffffff" } : { background: "#F8F9FB" }}
                >
                  {columns.map((column, columnIndex) => (
                    <td
                      key={`${String(column.key)}-${columnIndex}`}
                      className={`whitespace-nowrap px-3 py-2 text-sm text-steel-700 ${
                        isNumericColumn(column.label) ? "text-right tabular-nums font-semibold text-steel-800" : ""
                      }`}
                    >
                      {column.render ? column.render(row) : String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
