"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";

const reversalKinds = [
  { value: "sale", label: "Sale reversal" },
  { value: "empty-sale", label: "Empty sale reversal" },
  { value: "decanting-sale", label: "Decanting sale reversal" },
  { value: "purchase", label: "Purchase filled reversal" },
  { value: "purchase-empty", label: "Purchase empty reversal" },
  { value: "purchase-other", label: "Purchase other reversal" },
  { value: "cash-receipt", label: "Cash receipt reversal" },
  { value: "cash-payment", label: "Cash payment reversal" },
  { value: "bank-receipt", label: "Bank receipt reversal" },
  { value: "bank-payment", label: "Bank payment reversal" },
  { value: "cylinder-return", label: "Cylinder return reversal" },
];

export function ReversalPanel() {
  const searchParams = useSearchParams();
  const [values, setValues] = useState({
    kind: "sale",
    documentNo: "",
    reversalDate: new Date().toISOString().slice(0, 10),
    reason: "",
    allowClosedDayOverride: false,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const kind = searchParams.get("kind");
    const documentNo = searchParams.get("documentNo");
    setValues((current) => ({
      ...current,
      ...(kind && reversalKinds.some((option) => option.value === kind) ? { kind } : {}),
      ...(documentNo ? { documentNo } : {}),
    }));
  }, [searchParams]);

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
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Type *</span>
              <select
                value={values.kind}
                onChange={(event) => setValues((current) => ({ ...current, kind: event.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              >
                {reversalKinds.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Document Number *</span>
              <input
                value={values.documentNo}
                onChange={(event) => setValues((current) => ({ ...current, documentNo: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Reversal Date *</span>
              <input
                type="date"
                value={values.reversalDate}
                onChange={(event) => setValues((current) => ({ ...current, reversalDate: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.allowClosedDayOverride}
                onChange={(event) => setValues((current) => ({ ...current, allowClosedDayOverride: event.target.checked }))}
              />{" "}
              Closed-day override
            </label>
            <label className="block text-sm text-slate-700 md:col-span-2">
              <span className="mb-1 block font-medium">Reason</span>
              <input
                value={values.reason}
                onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
        </FormSection>
        <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Validate Reversal Policy</button>
      </form>
    </>
  );
}
