"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";

type StockLocation = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
};

export function WarehouseSelector({
  value,
  onChange,
  companyId,
  disabled,
  className,
}: {
  value: string;
  onChange: (locationId: string) => void;
  companyId?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiGet<{ stockLocations: StockLocation[] }>("/api/configuration/stock-locations?type=WAREHOUSE")
      .then((data) => {
        if (!cancelled) {
          setLocations(data.stockLocations);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className={className ?? "w-full rounded-md border border-slate-300 bg-white px-3 py-2"}
      aria-label="Select Warehouse"
    >
      <option value="">Select Warehouse...</option>
      {loading ? (
        <option value="" disabled>
          Loading warehouses...
        </option>
      ) : error ? (
        <option value="" disabled>
          Error loading warehouses
        </option>
      ) : locations.length === 0 ? (
        <option value="" disabled>
          No warehouses configured. Create one in Configuration &gt; Stock Locations.
        </option>
      ) : (
        locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            [{loc.code}] {loc.name}
          </option>
        ))
      )}
    </select>
  );
}
