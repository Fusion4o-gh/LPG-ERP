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
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
            Conversion number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`/sale-purchase/cylinder-conversion/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-blue-700 underline">
              Open printable view
            </Link>
          </div>
        ) : null}

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Conversion Header</div>
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Date *</span>
              <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Conversion / Reference No.</span>
              <input value={conversionNo} onChange={(event) => setConversionNo(event.target.value)} placeholder="Auto if blank" className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700 lg:col-span-2">
              <span className="mb-1 block font-medium">Remarks</span>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white">From Stock OUT</div>
            <div className="grid gap-4">
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">From Item *</span>
                <select value={fromItemId} onChange={(event) => setFromItemId(event.target.value)} disabled={lookupLoading} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                  <option value="">Select Item</option>
                  {items.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {optionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">From Quantity *</span>
                <input type="number" min="1" value={fromQuantity} onChange={(event) => setFromQuantity(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2 text-right" />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">To Stock IN</div>
            <div className="grid gap-4">
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">To Item *</span>
                <select value={toItemId} onChange={(event) => setToItemId(event.target.value)} disabled={lookupLoading} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                  <option value="">Select Item</option>
                  {items.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {optionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">To Quantity *</span>
                <input type="number" min="1" value={toQuantity} onChange={(event) => setToQuantity(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2 text-right" />
              </label>
            </div>
          </div>
        </section>

        <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white shadow-sm">
          <table className="min-w-[720px] w-full border-collapse text-sm">
            <thead className="bg-blue-50 text-left text-blue-950">
              <tr>
                <th className="border border-blue-100 px-3 py-2">Section</th>
                <th className="border border-blue-100 px-3 py-2">Item</th>
                <th className="border border-blue-100 px-3 py-2">Direction</th>
                <th className="border border-blue-100 px-3 py-2 text-right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-blue-100 px-3 py-2 font-semibold text-blue-800">From</td>
                <td className="border border-blue-100 px-3 py-2">{optionLabel(items.find((item) => item.id === fromItemId) ?? {}) || "Select Item"}</td>
                <td className="border border-blue-100 px-3 py-2">OUT</td>
                <td className="border border-blue-100 px-3 py-2 text-right tabular-nums">{fromQuantity || "0"}</td>
              </tr>
              <tr>
                <td className="border border-blue-100 px-3 py-2 font-semibold text-blue-800">To</td>
                <td className="border border-blue-100 px-3 py-2">{optionLabel(items.find((item) => item.id === toItemId) ?? {}) || "Select Item"}</td>
                <td className="border border-blue-100 px-3 py-2">IN</td>
                <td className="border border-blue-100 px-3 py-2 text-right tabular-nums">{toQuantity || "0"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Conversion</SubmitButton>
          <button type="button" onClick={reset} className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
