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
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
            Issue number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`/sale-purchase/decanting-sale/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-blue-700 underline">
              Open printable view
            </Link>
          </div>
        ) : null}

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Decanting Header</div>
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block text-sm text-slate-700 lg:col-span-2">
              <span className="mb-1 block font-medium">Customer</span>
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={lookupLoading} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={String(customer.id)} value={String(customer.id)}>
                    {optionLabel(customer)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Date/Time *</span>
              <input type="datetime-local" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Remarks</span>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Source Filled Stock OUT</div>
            <div className="grid gap-4">
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">Source Item *</span>
                <select value={sourceItemId} onChange={(event) => setSourceItemId(event.target.value)} disabled={lookupLoading} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                  <option value="">Select Item</option>
                  {items.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {optionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">Source Quantity *</span>
                <input type="number" min="1" value={sourceQuantity} onChange={(event) => setSourceQuantity(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2 text-right" />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Sale Amount</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">Decanted Qty *</span>
                <input type="number" min="0" value={decantedQuantity} onChange={(event) => setDecantedQuantity(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2 text-right" />
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">Unit Price</span>
                <input type="number" min="0" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2 text-right" />
              </label>
              <label className="block text-sm text-slate-700">
                <span className="mb-1 block font-medium">GST %</span>
                <input type="number" min="0" value={gstPercent} onChange={(event) => setGstPercent(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2 text-right" />
              </label>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-md bg-blue-50 p-3 text-blue-950">
                <div className="text-xs font-semibold uppercase">Ex-GST</div>
                <div className="mt-1 text-lg font-semibold">{money(totals.exGstAmount)}</div>
              </div>
              <div className="rounded-md bg-blue-50 p-3 text-blue-950">
                <div className="text-xs font-semibold uppercase">GST</div>
                <div className="mt-1 text-lg font-semibold">{money(totals.gstAmount)}</div>
              </div>
              <div className="rounded-md bg-blue-700 p-3 text-white">
                <div className="text-xs font-semibold uppercase">Total</div>
                <div className="mt-1 text-lg font-semibold">{money(totals.incGstAmount)}</div>
              </div>
            </div>
          </div>
        </section>

        <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white shadow-sm">
          <table className="min-w-[900px] w-full border-collapse text-sm">
            <thead className="bg-blue-50 text-left text-blue-950">
              <tr>
                <th className="border border-blue-100 px-3 py-2">Source Item</th>
                <th className="border border-blue-100 px-3 py-2 text-right">Source Qty OUT</th>
                <th className="border border-blue-100 px-3 py-2 text-right">Decanted Qty</th>
                <th className="border border-blue-100 px-3 py-2 text-right">Unit Price</th>
                <th className="border border-blue-100 px-3 py-2 text-right">GST %</th>
                <th className="border border-blue-100 px-3 py-2 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-blue-100 px-3 py-2">{optionLabel(items.find((item) => item.id === sourceItemId) ?? {}) || "Select Item"}</td>
                <td className="border border-blue-100 px-3 py-2 text-right tabular-nums">{sourceQuantity || "0"}</td>
                <td className="border border-blue-100 px-3 py-2 text-right tabular-nums">{decantedQuantity || "0"}</td>
                <td className="border border-blue-100 px-3 py-2 text-right tabular-nums">{unitPrice || "0"}</td>
                <td className="border border-blue-100 px-3 py-2 text-right tabular-nums">{gstPercent || "0"}</td>
                <td className="border border-blue-100 px-3 py-2 text-right font-semibold tabular-nums">{money(totals.incGstAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Decanting Sale</SubmitButton>
          <button type="button" onClick={reset} className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
