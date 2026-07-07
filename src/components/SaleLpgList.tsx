"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";

type SaleRow = {
  issueNo: string;
  voucherId: string;
  transactionDate: string;
  customerName: string;
  itemsSummary: string;
  totalAmount: string;
  amountReceived: string;
};

const PAGE_SIZES = [10, 25, 50, 100];

function defaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 15);
  return date.toISOString().slice(0, 10);
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: string) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function toCsv(rows: SaleRow[]) {
  const headers = ["Issue #", "Customer", "Item", "Date", "Total Amount", "Received"];
  const lines = rows.map((row) =>
    [row.issueNo, row.customerName, row.itemsSummary, formatDate(row.transactionDate), row.totalAmount, row.amountReceived]
      .map((cell) => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell))
      .join(","),
  );
  return `${headers.join(",")}\n${lines.join("\n")}\n`;
}

export function SaleLpgList() {
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(defaultToDate);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function load(nextPage = page, nextSearch = appliedSearch) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("limit", String(pageSize));
      params.set("offset", String((nextPage - 1) * pageSize));
      if (nextSearch) params.set("search", nextSearch);
      const data = await apiGet<{ sales: SaleRow[]; total: number }>(`/api/sales/lpg?${params.toString()}`);
      setRows(data.sales);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, appliedSearch);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
    load(1, search.trim());
  }

  function goToPage(nextPage: number) {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safePage);
    load(safePage, appliedSearch);
  }

  const pageButtons = useMemo(() => {
    const buttons: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let current = start; current <= end; current += 1) buttons.push(current);
    return buttons;
  }, [page, totalPages]);

  function exportCsv() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sale-lpg.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Manage Sale LPG"
        description="Search posted sale issues, open invoices, and start new sales."
        actions={
          <>
            <Link href="/operations/complete-day-sale" className="btn-primary-sm">
              + Add complete day sale
            </Link>
            <Link href="/operations/sale-lpg/add" className="btn-primary-sm">
              + Add New
            </Link>
          </>
        }
      />

      <section className="card rounded-xl overflow-hidden">
        <form onSubmit={submitFilters} className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">From Date</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">To Date</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input" />
            </label>
            <button type="submit" className="btn-primary-sm">
              Search
            </button>
          </div>
        </form>

        <div className="border-b border-slate-100 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <span>Display</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="form-input py-1.5"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span>records</span>
              </label>
              <span className="text-slate-400">|</span>
              <span>
                Showing {total === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span>Search:</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input py-1.5"
                  placeholder="Issue #, customer, item"
                />
              </label>
              <button type="button" onClick={() => void load(page, appliedSearch)} className="btn-outline px-2.5 py-1.5" title="Refresh">
                ↻
              </button>
              <button type="button" onClick={exportCsv} className="btn-outline px-2.5 py-1.5" title="Export CSV">
                CSV
              </button>
              <button type="button" onClick={() => window.print()} className="btn-outline px-2.5 py-1.5" title="Print">
                Print
              </button>
            </div>
          </div>
        </div>

        <ApiError message={error} />

        <div className="overflow-x-auto" data-report-print>
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th colSpan={7} className="px-4 py-2.5 text-left text-sm font-semibold">
                  Results for &apos;Sale LPG&apos;
                </th>
              </tr>
              <tr className="bg-blue-600 text-white">
                {["Issue #", "Customer", "Item", "Date", "Total Amount", "Received", "Actions"].map((label) => (
                  <th
                    key={label}
                    className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide ${
                      label === "Total Amount" || label === "Received" ? "text-right" : "text-left"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Loading sales…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No sales found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.issueNo} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.issueNo}</td>
                    <td className="px-4 py-3 text-slate-800">{row.customerName}</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-pre-wrap">{row.itemsSummary}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.transactionDate)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatMoney(row.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{formatMoney(row.amountReceived)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/operations/sale-lpg/print/${encodeURIComponent(row.issueNo)}`}
                          className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          title="Print invoice"
                        >
                          Print
                        </Link>
                        <Link
                          href={`/accounting/vouchers/${row.voucherId}`}
                          className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                          title="View voucher"
                        >
                          View
                        </Link>
                        <Link
                          href={`/operations/reversals?kind=sale&documentNo=${encodeURIComponent(row.issueNo)}`}
                          className="inline-flex h-8 min-w-8 items-center justify-center rounded border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          title="Reverse sale"
                        >
                          Reverse
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="btn-outline px-3 py-1.5 disabled:opacity-40">
              Previous
            </button>
            {pageButtons.map((buttonPage) => (
              <button
                key={buttonPage}
                type="button"
                onClick={() => goToPage(buttonPage)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  buttonPage === page ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {buttonPage}
              </button>
            ))}
            {totalPages > pageButtons[pageButtons.length - 1] ? <span className="px-1 text-slate-400">…</span> : null}
            <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="btn-outline px-3 py-1.5 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
