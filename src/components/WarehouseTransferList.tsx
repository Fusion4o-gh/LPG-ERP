"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";

type TransferRow = {
  id: string;
  documentNo: string;
  transferDate: string;
  sourceLocationId: string;
  destinationLocationId: string;
  status: string;
  lines: Array<{
    id: string;
    itemId: string;
    cylinderState: string;
    quantity: number;
    remarks: string | null;
  }>;
  _count: {
    lines: number;
  };
};

export function WarehouseTransferList() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (statusFilter) params.set("status", statusFilter);
      const query = params.toString();
      const data = await apiGet<{ transfers: TransferRow[] }>(
        `/api/inventory/warehouse-transfers${query ? `?${query}` : ""}`,
      );
      setTransfers(data.transfers);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load transfers.",
      );
    } finally {
      setLoading(false);
    }
  }, [from, to, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelTransfer(id: string) {
    if (!confirm("Are you sure you want to cancel this transfer?")) return;
    setCancellingId(id);
    setError("");
    try {
      await apiPost(`/api/inventory/warehouse-transfers/${id}/cancel`, {});
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel transfer.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  function statusBadge(status: string) {
    const styles: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
      COMPLETED: "bg-green-100 text-green-700 border-green-200",
      CANCELLED: "bg-red-100 text-red-700 border-red-200",
    };
    const s = styles[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
    return (
      <span
        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s}`}
      >
        {status}
      </span>
    );
  }

  return (
    <section className="card rounded-xl overflow-hidden mb-5">
      <div className="border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Recent Transfers
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Inter-warehouse cylinder transfer history.
          </p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <ApiError message={error} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="form-input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="form-input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Status
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-input"
            >
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <button type="button" onClick={load} className="btn-outline">
            Search
          </button>
        </div>

        <DataTable
          loading={loading}
          columns={[
            { key: "documentNo", label: "Document No" },
            { key: "status", label: "Status", render: (row) => statusBadge(String(row.status)) },
            {
              key: "transferDate",
              label: "Date",
              render: (row) =>
                new Date(String(row.transferDate)).toLocaleDateString(
                  "en-PK",
                ),
            },
            { key: "sourceLocationId", label: "Source" },
            { key: "destinationLocationId", label: "Destination" },
            {
              key: "_count",
              label: "Lines",
              render: (row) =>
                String((row._count as { lines: number })?.lines ?? 0),
            },
            {
              key: "id",
              label: "",
              render: (row) => (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(
                        expandedId === String(row.id) ? null : String(row.id),
                      )
                    }
                    className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    {expandedId === String(row.id) ? "Hide" : "Details"}
                  </button>
                  {row.status === "COMPLETED" && (
                    <button
                      type="button"
                      onClick={() => cancelTransfer(String(row.id))}
                      disabled={cancellingId === String(row.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
                    >
                      {cancellingId === String(row.id) ? "..." : "Cancel"}
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={(transfers ?? []).map((t) => ({
            ...t,
            id: t.id,
          }))}
        />

        {expandedId && transfers.length > 0 && (() => {
          const transfer = transfers.find((t) => t.id === expandedId);
          if (!transfer || !("lines" in transfer)) return null;
          const lines = transfer.lines ?? [];
          if (lines.length === 0) return null;
          return (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Item ID
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      State
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line) => (
                    <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2 text-slate-700">{line.itemId}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium text-slate-600">
                          {line.cylinderState}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                        {line.quantity}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {line.remarks ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
