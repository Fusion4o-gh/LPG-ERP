"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";

export function VoucherDetailPageClient({ id }: { id: string }) {
  const [voucher, setVoucher] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ voucher: Record<string, unknown> }>(`/api/accounting/vouchers/${id}`)
      .then((data) => setVoucher(data.voucher))
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const lines = (voucher?.lines as Record<string, unknown>[] | undefined) ?? [];

  return (
    <>
      <PageHeader title="Voucher Detail" description={voucher ? `${voucher.voucherNo} - ${voucher.balanceStatus}` : "Loading voucher..."} />
      <ApiError message={error} />
      <DataTable
        loading={!voucher && !error}
        rows={lines}
        columns={[
          { key: "account", label: "Account", render: (row) => `${(row.account as { code?: string })?.code ?? ""} ${(row.account as { name?: string })?.name ?? ""}` },
          { key: "description", label: "Description" },
          { key: "debit", label: "Debit" },
          { key: "credit", label: "Credit" },
        ]}
      />
      {voucher ? <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700">Debit: {String(voucher.totalDebit)} | Credit: {String(voucher.totalCredit)}</div> : null}
    </>
  );
}
