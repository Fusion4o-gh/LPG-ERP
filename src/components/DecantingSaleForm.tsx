"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function numberValue(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value: number) {
  return value.toFixed(2);
}

export function DecantingSaleForm() {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [sourceItemId, setSourceItemId] = useState("");
  const [sourceQuantity, setSourceQuantity] = useState("1");
  const [decantedQuantity, setDecantedQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [gstPercent, setGstPercent] = useState("0");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");

  useEffect(() => {
    Promise.all([apiGet<{ customers: Lookup[] }>("/api/customers"), apiGet<{ items: Lookup[] }>("/api/items")])
      .then(([customerData, itemData]) => {
        setCustomers(customerData.customers);
        setItems(itemData.items);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, []);

  const totals = useMemo(() => {
    const exGstAmount = numberValue(decantedQuantity) * numberValue(unitPrice);
    const gstAmount = exGstAmount * (numberValue(gstPercent) / 100);
    return { exGstAmount, gstAmount, incGstAmount: exGstAmount + gstAmount };
  }, [decantedQuantity, gstPercent, unitPrice]);

  function reset() {
    setCustomerId("");
    setTransactionDate("");
    setRemarks("");
    setSourceItemId("");
    setSourceQuantity("1");
    setDecantedQuantity("");
    setUnitPrice("");
    setGstPercent("0");
    setPrintDocumentNo("");
  }

  function payload() {
    const parsedSourceQuantity = numberValue(sourceQuantity);
    const parsedDecantedQuantity = numberValue(decantedQuantity);
    const parsedUnitPrice = numberValue(unitPrice);
    const parsedGstPercent = numberValue(gstPercent);
    if (!transactionDate) throw new Error("Date/time is required.");
    if (!sourceItemId) throw new Error("Source item is required.");
    if (!Number.isInteger(parsedSourceQuantity) || parsedSourceQuantity <= 0) throw new Error("Source quantity must be a positive integer.");
    if (parsedDecantedQuantity <= 0) throw new Error("Decanted quantity must be positive.");
    if (parsedUnitPrice < 0) throw new Error("Unit price cannot be negative.");
    if (parsedUnitPrice > 0 && !customerId) throw new Error("Customer is required when sale amount exists.");
    if (parsedGstPercent < 0) throw new Error("GST % cannot be negative.");
    return {
      customerId: customerId || undefined,
      transactionDate,
      remarks,
      sourceItemId,
      sourceQuantity: parsedSourceQuantity,
      decantedQuantity: parsedDecantedQuantity,
      unitPrice: parsedUnitPrice,
      gstPercent: parsedGstPercent,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const result = await apiPost<Record<string, unknown>>("/api/sale-purchase/decanting-sale", payload());
      const issueNo = String(result.issueNo ?? "saved");
      setSuccess(`Saved ${issueNo}.`);
      if (result.ids && issueNo !== "saved") setPrintDocumentNo(issueNo);
      setCustomerId("");
      setTransactionDate("");
      setRemarks("");
      setSourceItemId("");
      setSourceQuantity("1");
      setDecantedQuantity("");
      setUnitPrice("");
      setGstPercent("0");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Decanting Sale" description="Record decanting from a filled source cylinder with one issue number, filled stock OUT, receivable voucher when amount exists, GST payable, audit trail, and printable document." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        {printDocumentNo ? (
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">Issue number: <span className="font-semibold text-slate-900">{printDocumentNo}</span></span>
            <Link href={`/sale-purchase/decanting-sale/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        {/* Decanting Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Decanting Header</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="form-label" htmlFor="customerId">Customer</label>
                <select id="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Customer</option>
                  {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{optionLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="transactionDate">Date/Time *</label>
                <input id="transactionDate" type="datetime-local" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="remarks">Remarks</label>
                <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
              </div>
            </div>
          </div>
        </section>

        {/* Source + Sale panels */}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-blue-700 flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-white/50 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-blue-100">Source Filled Stock OUT</h2>
            </div>
            <div className="p-5 grid gap-4">
              <div>
                <label className="form-label" htmlFor="sourceItemId">Source Item *</label>
                <select id="sourceItemId" value={sourceItemId} onChange={(e) => setSourceItemId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Item</option>
                  {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="sourceQuantity">Source Quantity *</label>
                <input id="sourceQuantity" type="number" min="1" value={sourceQuantity} onChange={(e) => setSourceQuantity(e.target.value)} className="form-input text-right" />
              </div>
            </div>
          </section>

          <section className="card rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sale Amount</h2>
            </div>
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="form-label" htmlFor="decantedQuantity">Decanted Qty *</label>
                  <input id="decantedQuantity" type="number" min="0" value={decantedQuantity} onChange={(e) => setDecantedQuantity(e.target.value)} className="form-input text-right" />
                </div>
                <div>
                  <label className="form-label" htmlFor="unitPrice">Unit Price</label>
                  <input id="unitPrice" type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="form-input text-right" />
                </div>
                <div>
                  <label className="form-label" htmlFor="gstPercent">GST %</label>
                  <input id="gstPercent" type="number" min="0" value={gstPercent} onChange={(e) => setGstPercent(e.target.value)} className="form-input text-right" />
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ex-GST</div>
                  <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.exGstAmount)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">GST</div>
                  <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.gstAmount)}</div>
                </div>
                <div className="rounded-lg bg-blue-700 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Total</div>
                  <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(totals.incGstAmount)}</div>
                </div>
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
            <table className="min-w-[700px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Source Item", "Source Qty OUT", "Decanted Qty", "Unit Price", "GST %", "Total Amount"].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${i > 0 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-2.5 py-2 text-slate-800">{optionLabel(items.find((item) => item.id === sourceItemId) ?? {}) || <span className="italic text-slate-400">Select Item</span>}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{sourceQuantity || "0"}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{decantedQuantity || "0"}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{unitPrice || "0"}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{gstPercent || "0"}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums font-semibold text-slate-800">{money(totals.incGstAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Decanting Sale</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
