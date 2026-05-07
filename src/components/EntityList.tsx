"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";

type Column = { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode };

export function EntityList({ title, description, endpoint, dataKey, columns }: { title: string; description: string; endpoint: string; dataKey: string; columns: Column[] }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Record<string, Record<string, unknown>[]>>(endpoint)
      .then((data) => setRows(data[dataKey] ?? []))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [endpoint, dataKey]);

  return (
    <>
      <PageHeader title={title} description={description} />
      <ApiError message={error} />
      <DataTable rows={rows} loading={loading} columns={columns} />
    </>
  );
}
