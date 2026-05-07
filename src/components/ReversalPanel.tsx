"use client";

import { FormEvent, useState } from "react";
import { apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";

export function ReversalPanel() {
  const [values, setValues] = useState({ kind: "sale", documentNo: "", reversalDate: "", reason: "", allowClosedDayOverride: false });
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!values.documentNo || !values.reversalDate) {
      setError("Document number and reversal date are required.");
      return;
    }
    if (!window.confirm("Confirm reversal request? Phase 3D blocks unsafe deletion and only allows policy validation.")) return;
    try {
      await apiPost("/api/reversals", values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reversal failed.");
    }
  }

  return (
    <>
      <PageHeader title="Transaction Reversals" description="Policy stub for safe compensating reversals. Unsafe document deletion is blocked." />
      <ApiError message={error} />
      <form onSubmit={submit} className="max-w-2xl space-y-4">
        <FormSection title="Reversal Request">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Type *</span><select value={values.kind} onChange={(event) => setValues((current) => ({ ...current, kind: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="sale">Sale reversal</option><option value="purchase">Purchase reversal</option><option value="payment">Payment reversal</option><option value="cylinder-return">Cylinder return reversal</option></select></label>
            <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Document Number *</span><input value={values.documentNo} onChange={(event) => setValues((current) => ({ ...current, documentNo: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm text-slate-700"><span className="mb-1 block font-medium">Reversal Date *</span><input type="date" value={values.reversalDate} onChange={(event) => setValues((current) => ({ ...current, reversalDate: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={values.allowClosedDayOverride} onChange={(event) => setValues((current) => ({ ...current, allowClosedDayOverride: event.target.checked }))} /> Closed-day override</label>
            <label className="block text-sm text-slate-700 md:col-span-2"><span className="mb-1 block font-medium">Reason</span><input value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
          </div>
        </FormSection>
        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Validate Reversal Policy</button>
      </form>
    </>
  );
}

