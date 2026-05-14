"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { PageHeader } from "./PageHeader";

type VoucherRow = {
  id: string;
  voucherNo: string;
  voucherType: string;
  voucherDate: string;
  total: string | number;
  balanceStatus: string;
  sourceType: string;
};

const BANK_SOURCE_TYPES = new Set(["BankReceipt", "BankPayment"]);

const ACTIONS = [
  {
    label: "Bank Receipt",
    description: "Receive customer payment into bank. Creates balanced bank receipt voucher.",
    href: "/payments/bank-receipt",
    icon: "↓",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
  },
  {
    label: "Bank Payment",
    description: "Pay vendor from bank account. Creates balanced bank payment voucher.",
    href: "/payments/bank-payment",
    icon: "↑",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-700",
  },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "BankReceipt", label: "Receipt" },
  { value: "BankPayment", label: "Payment" },
];

function fmtDate(iso: string) {
  return String(iso).slice(0, 10);
}

export function BankPaymentsReceiptsClient() {
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    apiGet<{ vouchers: VoucherRow[] }>("/api/accounting/vouchers")
      .then((data) => setRows(data.vouchers.filter((v) => BANK_SOURCE_TYPES.has(v.sourceType))))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter && r.sourceType !== typeFilter) return false;
      const d = fmtDate(r.voucherDate);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [rows, typeFilter, fromDate, toDate]);

  return (
    <>
      <PageHeader title="Bank Payments / Receipt" description="Post bank receipts from customers and bank payments to vendors." />

      <ApiError message={error} />

      {/* Action cards */}
      <div className="grid gap-4 sm:grid-cols-2 mb-7 max-w-2xl">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-start gap-4 rounded-xl border border-blue-100 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold ${action.iconBg} ${action.iconColor}`}>
              {action.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{action.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent bank vouchers */}
      <div className="rounded-xl border border-blue-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-blue-50 px-5 py-3">
          <p className="text-sm font-semibold text-slate-700 mr-auto">Recent Bank Vouchers</p>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="p-2">
          <DataTable
            loading={loading}
            rows={filtered as Record<string, unknown>[]}
            columns={[
              {
                key: "voucherNo",
                label: "Voucher No",
                render: (row) => (
                  <Link className="font-semibold text-slate-950 underline" href={`/accounting/vouchers/${row.id}`}>
                    {String(row.voucherNo)}
                  </Link>
                ),
              },
              {
                key: "sourceType",
                label: "Type",
                render: (row) => (
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    row.sourceType === "BankReceipt" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"
                  }`}>
                    {row.sourceType === "BankReceipt" ? "Receipt" : "Payment"}
                  </span>
                ),
              },
              { key: "voucherDate", label: "Date", render: (row) => fmtDate(String(row.voucherDate)) },
              { key: "total", label: "Amount" },
              { key: "balanceStatus", label: "Status" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
