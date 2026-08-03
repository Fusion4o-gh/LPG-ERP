"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Status = { lastClosedDate: string | null; nextCloseDate: string; lastClosedBy?: { name: string; loginId: string } | null; history?: { id: string; closedDate: string; closedBy: { name: string; loginId: string }; cashBalance: number | string; notes?: string | null; status: string }[] };
type Reconciliation = { closedDate: string; voucherCount: number; unbalancedVoucherCount: number; stockMovementCount: number; stockInQuantity: number; stockOutQuantity: number; cashMovement: number; bankMovement: number; isBalanced: boolean };

function dateValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function DayClosingPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [closedDate, setClosedDate] = useState("");
  const [cashBalance, setCashBalance] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(nextDate?: string) {
    const query = nextDate ? `?date=${encodeURIComponent(nextDate)}` : "";
    const data = await apiGet<{ status: Status; reconciliation: Reconciliation }>(`/api/day-closing${query}`);
    setStatus(data.status);
    setClosedDate(dateValue(data.status.nextCloseDate));
    setReconciliation(data.reconciliation);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  async function closeDay(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!closedDate) {
      setError("Close date is required.");
      return;
    }
    if (!window.confirm(`Close business day ${closedDate}? Backdated writes before or on this date will be blocked.`)) return;
    try {
      const check = await apiGet<{ reconciliation: Reconciliation }>(`/api/day-closing?date=${encodeURIComponent(closedDate)}`);
      setReconciliation(check.reconciliation);
      if (!check.reconciliation.isBalanced) {
        setError(`Day cannot be closed: ${check.reconciliation.unbalancedVoucherCount} unbalanced voucher(s) found.`);
        return;
      }
      await apiPost("/api/day-closing", { closedDate, cashBalance: Number(cashBalance || 0), notes });
      setSuccess(`Closed day ${closedDate}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Day closing failed.");
    }
  }

  async function reopen(action: "request" | "reopen") {
    setError("");
    setSuccess("");
    const message = action === "request" ? "Request reopen for the last closed day?" : "Approve reopen for the last closed day?";
    if (!window.confirm(message)) return;
    try {
      await apiPost("/api/day-closing/reopen", { action, reason: notes });
      setSuccess(action === "request" ? "Reopen request recorded." : "Day reopened.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reopen failed.");
    }
  }

  return (
    <>
      <PageHeader title="Day Closing" description="Close operating days and enforce backdated write controls." />
      <ApiError message={error} />
      <SuccessMessage message={success} />
      <div className="grid gap-5 lg:grid-cols-2">
        <FormSection title="Closing Status">
          {loading ? (
            <div className="text-sm text-slate-600">Loading...</div>
          ) : (
            <dl className="space-y-2 text-sm">
              <div><dt className="font-semibold text-slate-700">Last Closed Date</dt><dd>{dateValue(status?.lastClosedDate) || "None"}</dd></div>
              <div><dt className="font-semibold text-slate-700">Next Close Date</dt><dd>{dateValue(status?.nextCloseDate)}</dd></div>
              <div><dt className="font-semibold text-slate-700">Closed By</dt><dd>{status?.lastClosedBy ? `${status.lastClosedBy.name} (${status.lastClosedBy.loginId})` : "None"}</dd></div>
            </dl>
          )}
        </FormSection>
        <form onSubmit={closeDay} className="space-y-4">
          <FormSection title="Close Day">
            <div className="space-y-3">
              <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Close Date *</span><input type="date" value={closedDate} onChange={(event) => { setClosedDate(event.target.value); setReconciliation(null); }} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
              <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Cash Balance</span><input type="number" min="0" value={cashBalance} onChange={(event) => setCashBalance(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
              <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Notes</span><input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
              {reconciliation ? <div className={`rounded-md border p-3 text-sm ${reconciliation.isBalanced ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                <p className="font-semibold">Reconciliation {reconciliation.isBalanced ? "passed" : "requires correction"}</p>
                <p className="mt-1">Vouchers: {reconciliation.voucherCount} · Stock movements: {reconciliation.stockMovementCount} · In: {reconciliation.stockInQuantity} · Out: {reconciliation.stockOutQuantity}</p>
                <p>Cash movement: {reconciliation.cashMovement.toFixed(2)} · Bank movement: {reconciliation.bankMovement.toFixed(2)} · Unbalanced vouchers: {reconciliation.unbalancedVoucherCount}</p>
                <Link href={`/operations/day-closing/print/${encodeURIComponent(closedDate)}`} className="mt-2 inline-block font-medium underline">Open printable reconciliation</Link>
              </div> : <p className="text-sm text-slate-500">Submit Close Day to run reconciliation before posting the close.</p>}
            </div>
          </FormSection>
          <div className="flex gap-2">
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Close Day</button>
            <button type="button" onClick={() => reopen("request")} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Request Reopen</button>
            <button type="button" onClick={() => reopen("reopen")} className="rounded-md border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700">Approve Reopen</button>
          </div>
        </form>
      </div>
      <FormSection title="Close History">
        {status?.history?.length ? <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Closed By</th><th className="px-3 py-2">Cash Balance</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Notes</th></tr></thead><tbody className="divide-y divide-slate-100">{status.history.map((row) => <tr key={row.id}><td className="px-3 py-2">{dateValue(row.closedDate)}</td><td className="px-3 py-2">{row.closedBy.name}</td><td className="px-3 py-2 tabular-nums">{Number(row.cashBalance).toFixed(2)}</td><td className="px-3 py-2 capitalize">{row.status.replaceAll("_", " ")}</td><td className="px-3 py-2">{row.notes || ""}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No closed days recorded.</p>}
      </FormSection>
    </>
  );
}

