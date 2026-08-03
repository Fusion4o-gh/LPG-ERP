"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";

type Reconciliation = { closedDate: string; voucherCount: number; unbalancedVoucherCount: number; stockMovementCount: number; stockInQuantity: number; stockOutQuantity: number; cashMovement: number; bankMovement: number; isBalanced: boolean };
export function DayClosingPrintClient({ date }: { date: string }) {
  const [report, setReport] = useState<Reconciliation | null>(null); const [error, setError] = useState("");
  useEffect(() => { apiGet<{ reconciliation: Reconciliation }>(`/api/day-closing?date=${encodeURIComponent(date)}`).then((data) => setReport(data.reconciliation)).catch((err: Error) => setError(err.message)); }, [date]);
  return <section data-report-print className="mx-auto max-w-3xl space-y-5 bg-white p-6"><div data-print-hidden className="flex justify-end"><button type="button" onClick={() => window.print()} className="btn-primary">Print</button></div><ApiError message={error} />{report ? <><header className="border-b pb-4"><h1 className="text-2xl font-semibold">Day Closing Reconciliation</h1><p className="text-sm text-slate-600">Closed date: {report.closedDate}</p></header><div className={`rounded border p-4 ${report.isBalanced ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className="font-semibold">{report.isBalanced ? "Reconciliation passed" : "Reconciliation requires correction"}</p><p className="text-sm">Unbalanced vouchers: {report.unbalancedVoucherCount}</p></div><table className="w-full border-collapse text-sm"><tbody>{[["Posted vouchers", report.voucherCount], ["Stock movements", report.stockMovementCount], ["Stock in quantity", report.stockInQuantity], ["Stock out quantity", report.stockOutQuantity], ["Cash movement", Number(report.cashMovement).toFixed(2)], ["Bank movement", Number(report.bankMovement).toFixed(2)]].map(([label, value]) => <tr key={String(label)}><th className="border px-3 py-2 text-left">{label}</th><td className="border px-3 py-2 text-right">{value}</td></tr>)}</tbody></table><footer className="border-t pt-3 text-center text-xs text-slate-500">LPG Management System · Day closing reconciliation</footer></> : !error ? <p>Loading reconciliation…</p> : null}</section>;
}
