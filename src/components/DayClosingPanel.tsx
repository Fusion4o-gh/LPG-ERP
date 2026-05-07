"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Status = { lastClosedDate: string | null; nextCloseDate: string; lastClosedBy?: { name: string; loginId: string } | null };

function dateValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function DayClosingPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [closedDate, setClosedDate] = useState("");
  const [cashBalance, setCashBalance] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await apiGet<{ status: Status }>("/api/day-closing");
    setStatus(data.status);
    setClosedDate(dateValue(data.status.nextCloseDate));
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
      await apiPost("/api/day-closing", { closedDate, cashBalance: Number(cashBalance || 0), notes });
      setSuccess(`Closed day ${closedDate}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Day closing failed.");
    }
  }

  async function reopen() {
    setError("");
    setSuccess("");
    if (!window.confirm("Request reopen for the last closed day? This requires override permission and is blocked until reversal policy is finalized.")) return;
    try {
      await apiPost("/api/day-closing/reopen", {});
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
              <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Close Date *</span><input type="date" value={closedDate} onChange={(event) => setClosedDate(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
              <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Cash Balance</span><input type="number" min="0" value={cashBalance} onChange={(event) => setCashBalance(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
              <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Notes</span><input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            </div>
          </FormSection>
          <div className="flex gap-2">
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Close Day</button>
            <button type="button" onClick={reopen} className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">Request Reopen</button>
          </div>
        </form>
      </div>
    </>
  );
}

