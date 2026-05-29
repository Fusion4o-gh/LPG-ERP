"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";

type SaleRow = {
  issueNo: string;
  transactionDate: string;
  customerName: string;
  totalReceivableAmount: string;
  netReceivableAmount: string;
  amountReceived: string;
  lineCount: number;
};

export function SaleLpgList() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const query = params.toString();
      const data = await apiGet<{ sales: SaleRow[] }>(`/api/sales/lpg${query ? `?${query}` : ""}`);
      setRows(data.sales);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="card rounded-xl overflow-hidden mb-5">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Recent Sales</h2>
          <p className="mt-0.5 text-sm text-slate-500">Matches legacy Sale LPG list with date filters.</p>
        </div>
        <Link href="#sale-lpg-form" className="btn-primary-sm">
          Add New Sale
        </Link>
      </div>
      <div className="p-5 space-y-4">
        <ApiError message={error} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="form-input" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="form-input" />
          </label>
          <button type="button" onClick={load} className="btn-outline">
            Search
          </button>
        </div>
        <DataTable
          loading={loading}
          columns={[
            { key: "issueNo", label: "Issue #" },
            { key: "customerName", label: "Customer" },
            { key: "transactionDate", label: "Date" },
            { key: "netReceivableAmount", label: "Net Bill" },
            { key: "amountReceived", label: "Received" },
            {
              key: "issueNo",
              label: "",
              render: (row) => (
                <Link
                  href={`/operations/sale-lpg/print/${encodeURIComponent(String(row.issueNo))}`}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Print
                </Link>
              ),
            },
          ]}
          rows={rows.map((row) => ({
            ...row,
            id: row.issueNo,
            transactionDate: new Date(row.transactionDate).toLocaleDateString("en-PK"),
          }))}
        />
      </div>
    </section>
  );
}
