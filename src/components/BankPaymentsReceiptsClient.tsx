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
    iconBg: "bg-flame-100",
    iconColor: "text-flame-700",
  },
  {
    label: "Bank Payment",
    description: "Pay vendor from bank account. Creates balanced bank payment voucher.",
    href: "/payments/bank-payment",
    icon: "↑",
    iconBg: "bg-steel-100",
    iconColor: "text-steel-700",
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
            className="card surface-press flex items-start gap-4 rounded-xl p-5 transition-all"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl font-bold ${action.iconBg} ${action.iconColor}`} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 1px 1px 3px rgba(0,0,0,0.1)' }}>
              {action.icon}
            </span>
            <div>
              <p className="text-sm font-bold text-gas-800">{action.label}</p>
              <p className="mt-1 text-xs leading-5 text-steel-500">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent bank vouchers */}
      <div className="card rounded-xl overflow-hidden">
        <div className="accent-section-header flex flex-wrap items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-steel-600 mr-auto">Recent Bank Vouchers</p>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="tbl-select"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="tbl-input" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="tbl-input" />
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
                  <Link className="font-bold text-gas-700 underline" href={`/accounting/vouchers/${row.id}`}>
                    {String(row.voucherNo)}
                  </Link>
                ),
              },
              {
                key: "sourceType",
                label: "Type",
                render: (row) => (
                  <span className={`skeu-pill ${
                    row.sourceType === "BankReceipt"
                      ? "bg-gradient-to-br from-flame-100 to-flame-200 text-flame-800"
                      : "bg-gradient-to-br from-steel-100 to-steel-200 text-steel-800"
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
