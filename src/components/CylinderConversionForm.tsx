"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function positiveInteger(value: string, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return number;
}

export function CylinderConversionForm() {
  const [items, setItems] = useState<Lookup[]>([]);
  const [transactionDate, setTransactionDate] = useState("");
  const [conversionNo, setConversionNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [fromItemId, setFromItemId] = useState("");
  const [fromQuantity, setFromQuantity] = useState("1");
  const [toItemId, setToItemId] = useState("");
  const [toQuantity, setToQuantity] = useState("1");
  const [lookupLoading, setLookupLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");

  useEffect(() => {
    apiGet<{ items: Lookup[] }>("/api/items")
      .then((itemData) => setItems(itemData.items))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, []);

  function reset() {
    setTransactionDate("");
    setConversionNo("");
    setRemarks("");
    setFromItemId("");
    setFromQuantity("1");
    setToItemId("");
    setToQuantity("1");
    setPrintDocumentNo("");
  }

  function payload() {
    if (!transactionDate) throw new Error("Date is required.");
    if (!fromItemId) throw new Error("From item is required.");
    if (!toItemId) throw new Error("To item is required.");
    return {
      transactionDate,
      conversionNo: conversionNo || undefined,
      remarks,
      fromItemId,
      fromQuantity: positiveInteger(fromQuantity, "From quantity"),
      toItemId,
      toQuantity: positiveInteger(toQuantity, "To quantity"),
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const result = await apiPost<Record<string, unknown>>("/api/sale-purchase/cylinder-conversion", payload());
      const savedNo = String(result.conversionNo ?? "saved");
      setSuccess(`Saved ${savedNo}.`);
      if (savedNo !== "saved") setPrintDocumentNo(savedNo);
      reset();
      setSuccess(`Saved ${savedNo}.`);
      setPrintDocumentNo(savedNo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Cylinder Conversion" description="Convert stock from one cylinder item into another with one conversion number, source stock OUT, destination stock IN, audit trail, and no financial voucher by default." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        {printDocumentNo ? (
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">Conversion number: <span className="font-semibold text-slate-900">{printDocumentNo}</span></span>
            <Link href={`/sale-purchase/cylinder-conversion/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        {/* Conversion Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Conversion Header</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <div>
                <label className="form-label" htmlFor="transactionDate">Date *</label>
                <input id="transactionDate" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="conversionNo">Conversion / Reference No.</label>
                <input id="conversionNo" value={conversionNo} onChange={(e) => setConversionNo(e.target.value)} placeholder="Auto if blank" className="form-input" />
              </div>
              <div className="lg:col-span-2">
                <label className="form-label" htmlFor="remarks">Remarks</label>
                <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
              </div>
            </div>
          </div>
        </section>

        {/* From / To panels */}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-blue-700 flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-white/50 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-100">From Stock OUT</h2>
            </div>
            <div className="p-5 grid gap-4">
              <div>
                <label className="form-label" htmlFor="fromItemId">From Item *</label>
                <select id="fromItemId" value={fromItemId} onChange={(e) => setFromItemId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Item</option>
                  {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="fromQuantity">From Quantity *</label>
                <input id="fromQuantity" type="number" min="1" value={fromQuantity} onChange={(e) => setFromQuantity(e.target.value)} className="form-input text-right" />
              </div>
            </div>
          </section>

          <section className="card rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">To Stock IN</h2>
            </div>
            <div className="p-5 grid gap-4">
              <div>
                <label className="form-label" htmlFor="toItemId">To Item *</label>
                <select id="toItemId" value={toItemId} onChange={(e) => setToItemId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Item</option>
                  {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="toQuantity">To Quantity *</label>
                <input id="toQuantity" type="number" min="1" value={toQuantity} onChange={(e) => setToQuantity(e.target.value)} className="form-input text-right" />
              </div>
            </div>
          </section>
        </div>

        {/* Summary Table */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Transaction Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[560px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Section", "Item", "Direction", "Quantity"].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-2.5 py-2 font-semibold text-blue-700">From</td>
                  <td className="px-2.5 py-2 text-slate-800">{optionLabel(items.find((item) => item.id === fromItemId) ?? {}) || <span className="italic text-slate-400">Select Item</span>}</td>
                  <td className="px-2.5 py-2 text-slate-500">OUT</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-slate-800">{fromQuantity || "0"}</td>
                </tr>
                <tr className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-2.5 py-2 font-semibold text-blue-700">To</td>
                  <td className="px-2.5 py-2 text-slate-800">{optionLabel(items.find((item) => item.id === toItemId) ?? {}) || <span className="italic text-slate-400">Select Item</span>}</td>
                  <td className="px-2.5 py-2 text-slate-500">IN</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-slate-800">{toQuantity || "0"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Conversion</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
