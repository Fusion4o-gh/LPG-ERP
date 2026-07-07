"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { purchaseRoutes } from "@/lib/purchase-routes";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";

type PurchaseRow = {
  receiptNo: string;
  voucherId: string;
  transactionDate: string;
  vendorCode: string;
  vendorName: string;
  itemsSummary: string;
  totalAmount: string;
  amountPaid: string;
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function PurchaseFilledCylinderList() {
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(defaultToDate);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PurchaseRow[]>([]);
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
      const data = await apiGet<{ purchases: PurchaseRow[]; total: number }>(`/api/purchases/filled-cylinder?${params.toString()}`);
      setRows(data.purchases);
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

  return (
    <>
      <PageHeader
        title="Manage Purchase Filled"
        description="Search posted GIRN receipts and start new filled-cylinder purchases."
        actions={
          <Link href={purchaseRoutes.filled.add} className="btn-primary-sm">
            + Add New
          </Link>
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
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="form-input py-1.5">
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
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Search:</span>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input py-1.5" placeholder="Receipt #, vendor" />
            </label>
          </div>
        </div>

        <ApiError message={error} />

        <div className="overflow-x-auto" data-report-print>
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-blue-700 text-white">
                <th colSpan={5} className="px-4 py-2.5 text-left text-sm font-semibold">
                  Results for &apos;Purchase Filled&apos;
                </th>
              </tr>
              <tr className="bg-blue-600 text-white">
                {["Receipt #", "Vendor Code", "Vendor Name", "Date", "Actions"].map((label) => (
                  <th key={label} className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-left">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Loading purchases…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No purchases found for the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.receiptNo} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.receiptNo}</td>
                    <td className="px-4 py-3 text-slate-700">{row.vendorCode}</td>
                    <td className="px-4 py-3 text-slate-800">{row.vendorName}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.transactionDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={purchaseRoutes.filled.print(row.receiptNo)}
                          className="inline-flex h-8 items-center justify-center rounded border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Print
                        </Link>
                        <Link
                          href={`/accounting/vouchers/${row.voucherId}`}
                          className="inline-flex h-8 items-center justify-center rounded border border-amber-200 bg-amber-50 px-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          View
                        </Link>
                        <Link
                          href={`/operations/reversals?kind=purchase&documentNo=${encodeURIComponent(row.receiptNo)}`}
                          className="inline-flex h-8 items-center justify-center rounded border border-rose-200 bg-rose-50 px-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
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
            <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="btn-outline px-3 py-1.5 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
