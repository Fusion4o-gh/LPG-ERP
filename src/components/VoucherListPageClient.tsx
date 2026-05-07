"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";

export function VoucherListPageClient() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ vouchers: Record<string, unknown>[] }>("/api/accounting/vouchers")
      .then((data) => setRows(data.vouchers))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Voucher List" description="Accounting vouchers created by operational transactions." />
      <ApiError message={error} />
      <DataTable
        loading={loading}
        rows={rows}
        columns={[
          { key: "voucherNo", label: "Voucher No", render: (row) => <Link className="font-semibold text-slate-950 underline" href={`/accounting/vouchers/${row.id}`}>{String(row.voucherNo)}</Link> },
          { key: "voucherType", label: "Type" },
          { key: "voucherDate", label: "Date", render: (row) => String(row.voucherDate).slice(0, 10) },
          { key: "total", label: "Total" },
          { key: "balanceStatus", label: "Status" },
        ]}
      />
    </>
  );
}
