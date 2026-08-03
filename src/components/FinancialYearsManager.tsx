"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

type Year = { id: string; label: string; startsOn: string; endsOn: string; isActive: boolean; isClosed: boolean; closedAt?: string | null; openingBalancesLockedAt?: string | null };

export function FinancialYearsManager() {
  const [years, setYears] = useState<Year[]>([]);
  const [label, setLabel] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() { try { setYears((await apiGet<{ financialYears: Year[] }>("/api/configuration/financial-years")).financialYears); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load financial years."); } }
  useEffect(() => { void load(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess(""); setSaving(true);
    try { await apiPost("/api/configuration/financial-years", { label, startsOn, endsOn, isActive: true }); setLabel(""); setStartsOn(""); setEndsOn(""); setSuccess("Financial year created."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create financial year."); }
    finally { setSaving(false); }
  }
  async function lockOpeningBalances(year: Year) {
    if (year.openingBalancesLockedAt || year.isClosed || !window.confirm(`Lock opening balances for ${year.label}? This cannot be undone.`)) return;
    setError(""); setSuccess(""); setSaving(true);
    try { await apiPost(`/api/configuration/financial-years/${year.id}/opening-lock`, {}); setSuccess(`Opening balances locked for ${year.label}.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to lock opening balances."); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeader title="Financial Years" description="Create and review accounting periods used by LPG transactions and reports." />
    <ApiError message={error} /><SuccessMessage message={success} />
    <FormSection title="Add Financial Year">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
        <input required placeholder="Label (e.g. 2026-27)" value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" />
        <input required type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" aria-label="Starts on" />
        <input required type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2" aria-label="Ends on" />
        <button disabled={saving} className="rounded-md bg-blue-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Create Financial Year"}</button>
      </form>
    </FormSection>
    <FormSection title="Available Financial Years">
      <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left"><th className="px-3 py-2">Label</th><th className="px-3 py-2">Starts</th><th className="px-3 py-2">Ends</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Opening balances</th><th className="px-3 py-2">Actions</th></tr></thead><tbody>{years.map((year) => <tr key={year.id} className="border-b"><td className="px-3 py-2 font-medium">{year.label}</td><td className="px-3 py-2">{new Date(year.startsOn).toLocaleDateString()}</td><td className="px-3 py-2">{new Date(year.endsOn).toLocaleDateString()}</td><td className="px-3 py-2">{year.isClosed ? "Closed" : year.isActive ? "Active" : "Open"}</td><td className="px-3 py-2">{year.openingBalancesLockedAt ? "Locked" : "Open"}</td><td className="px-3 py-2">{year.openingBalancesLockedAt || year.isClosed ? <span className="text-xs text-slate-500">No changes</span> : <button type="button" disabled={saving} onClick={() => lockOpeningBalances(year)} className="btn-outline !px-2 !py-1 !text-xs">Lock opening balances</button>}</td></tr>)}</tbody></table></div>
    </FormSection>
  </>;
}
