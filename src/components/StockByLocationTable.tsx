"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";

type StockRow = {
  locationId: string;
  locationCode: string;
  locationName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  filledQuantity: number;
  emptyQuantity: number;
};

type StockLocation = {
  id: string;
  code: string;
  name: string;
};

export function StockByLocationTable() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLocations = useCallback(async () => {
    try {
      const data = await apiGet<{ stockLocations: StockLocation[] }>(
        "/api/configuration/stock-locations?type=WAREHOUSE",
      );
      setLocations(data.stockLocations);
    } catch {
      // Optional filter - not critical if location list fails
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (locationId) params.set("locationId", locationId);
      const query = params.toString();
      const data = await apiGet<{ rows: StockRow[] }>(
        `/api/reports/stock-by-location${query ? `?${query}` : ""}`,
      );
      setRows(data.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stock data.");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    load();
  }, [load]);

  // Group rows by location
  const grouped = new Map<string, StockRow[]>();
  for (const row of rows) {
    const groupKey = row.locationId || "__unassigned__";
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey)!.push(row);
  }

  return (
    <section className="card rounded-xl overflow-hidden mb-5">
      <div className="border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Stock by Location
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Filled and empty cylinder quantities per warehouse location.
          </p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <ApiError message={error} />

        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Location</span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="form-input"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  [{loc.code}] {loc.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={load} className="btn-outline">
            Search
          </button>
        </div>

        {loading ? (
          <DataTable
            loading
            columns={[
              { key: "locationCode", label: "Location Code" },
              { key: "locationName", label: "Location Name" },
              { key: "itemCode", label: "Item Code" },
              { key: "itemName", label: "Item Name" },
              { key: "filledQuantity", label: "Filled Qty" },
              { key: "emptyQuantity", label: "Empty Qty" },
            ]}
            rows={[]}
          />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No stock data found for the selected criteria.
          </div>
        ) : (
          [...grouped.entries()].map(([groupKey, groupRows]) => {
            const firstRow = groupRows[0];
            const label =
              groupKey === "__unassigned__"
                ? "— Unassigned"
                : `[${firstRow.locationCode}] ${firstRow.locationName}`;
            return (
              <div key={groupKey} className="overflow-x-auto rounded-lg border border-slate-200">
                <div className="bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {label}
                </div>
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Item Code
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Item Name
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Filled Qty
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Empty Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupRows.map((row, i) => (
                      <tr key={`${row.itemId}-${i}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2 font-medium text-slate-700">{row.itemCode}</td>
                        <td className="px-3 py-2 text-slate-600">{row.itemName}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.filledQuantity}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.emptyQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
