"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { DataTable } from "./DataTable";
import { ApiError } from "./ApiError";
import { CylinderState } from "@prisma/client";

type CountRow = {
  id: string;
  documentNo: string;
  status: string;
  countDate: string;
  locationCode: string;
  totalLines: number;
  totalVariance: number;
  createdAt: string;
};

type CountLineRow = {
  id: string;
  itemCode: string;
  itemName: string;
  cylinderState: CylinderState;
  systemQuantity: number;
  countedQuantity: number;
  variance: number;
};

export function PhysicalCountList() {
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Detail view state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<CountLineRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [detailCount, setDetailCount] = useState<CountRow | null>(null);

  const refresh = () => {
    setLoading(true);
    setError("");
    apiGet<{ counts: CountRow[] }>("/api/inventory/physical-counts")
      .then((data) => setCounts(data.counts))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  function viewDetail(count: CountRow) {
    setSelectedId(count.id);
    setDetailCount(count);
    setLinesLoading(true);
    apiGet<{ lines: CountLineRow[] }>(
      `/api/inventory/physical-counts/${count.id}`,
    )
      .then((data) => setLines(data.lines))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLinesLoading(false));
  }

  async function approveCount(id: string) {
    if (!confirm("Approve this count? Adjustment entries will be posted.")) {
      return;
    }
    setError("");
    try {
      await apiPost(`/api/inventory/physical-counts/${id}/approve`, {});
      refresh();
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve count.");
    }
  }

  if (selectedId && detailCount) {
    return (
      <section className="card rounded-xl overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 flex items-center justify-between">
          <div>
            <button
              onClick={() => {
                setSelectedId(null);
                setDetailCount(null);
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 mr-3"
            >
              &larr; Back
            </button>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Count {detailCount.documentNo} &mdash; {detailCount.locationCode}
            </span>
          </div>
          <div className="flex gap-2">
            {detailCount.status === "DRAFT" && (
              <button
                onClick={() => approveCount(detailCount.id)}
                className="btn-primary-sm"
              >
                Approve
              </button>
            )}
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                detailCount.status === "APPROVED"
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {detailCount.status}
            </span>
          </div>
        </div>
        <div className="p-5">
          <ApiError message={error} />
          <DataTable
            columns={[
              { key: "itemCode", label: "Item Code" },
              { key: "itemName", label: "Item Name" },
              { key: "cylinderState", label: "State" },
              {
                key: "systemQuantity",
                label: "System",
                render: (row) =>
                  Number(row.systemQuantity).toLocaleString(),
              },
              {
                key: "countedQuantity",
                label: "Counted",
                render: (row) =>
                  Number(row.countedQuantity).toLocaleString(),
              },
              {
                key: "variance",
                label: "Variance",
                render: (row) => {
                  const v = Number(row.variance);
                  return (
                    <span className={v !== 0 ? "font-semibold text-red-600" : ""}>
                      {v > 0 ? "+" : ""}
                      {v.toLocaleString()}
                    </span>
                  );
                },
              },
            ]}
            rows={lines}
            loading={linesLoading}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Physical Counts
        </h2>
        <span className="text-xs text-slate-400">{counts.length} count(s)</span>
      </div>
      <div className="p-5">
        <ApiError message={error} />
        <DataTable
          columns={[
            { key: "documentNo", label: "Doc No" },
            { key: "locationCode", label: "Location" },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    row.status === "APPROVED"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {String(row.status)}
                </span>
              ),
            },
            {
              key: "countDate",
              label: "Date",
              render: (row) =>
                new Date(String(row.countDate)).toLocaleDateString(),
            },
            {
              key: "totalLines",
              label: "Lines",
              render: (row) => Number(row.totalLines).toLocaleString(),
            },
            {
              key: "totalVariance",
              label: "Variance",
              render: (row) => Number(row.totalVariance).toLocaleString(),
            },
            {
              key: "createdAt",
              label: "Created",
              render: (row) =>
                new Date(String(row.createdAt)).toLocaleDateString(),
            },
            {
              key: "actions" as never,
              label: "",
              render: (row) => (
                <button
                  onClick={() => viewDetail(row as unknown as CountRow)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  View
                </button>
              ),
            },
          ]}
          rows={counts}
          loading={loading}
        />
      </div>
    </section>
  );
}
