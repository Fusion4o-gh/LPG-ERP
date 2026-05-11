"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type EmptySaleLine = {
  itemId: string;
  quantity: string;
  unitPrice: string;
  gstPercent: string;
};

const blankLine: EmptySaleLine = { itemId: "", quantity: "1", unitPrice: "", gstPercent: "0" };

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function numberValue(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineTotals(line: EmptySaleLine) {
  const exGstAmount = numberValue(line.quantity) * numberValue(line.unitPrice);
  const gstAmount = exGstAmount * (numberValue(line.gstPercent) / 100);
  return { exGstAmount, gstAmount, incGstAmount: exGstAmount + gstAmount };
}

function money(value: number) {
  return value.toFixed(2);
}

export function EmptySaleForm() {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<EmptySaleLine[]>([{ ...blankLine }]);
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

  const totals = useMemo(
    () =>
      lines.reduce(
        (sum, line) => {
          const current = lineTotals(line);
          return {
            exGstAmount: sum.exGstAmount + current.exGstAmount,
            gstAmount: sum.gstAmount + current.gstAmount,
            incGstAmount: sum.incGstAmount + current.incGstAmount,
          };
        },
        { exGstAmount: 0, gstAmount: 0, incGstAmount: 0 },
      ),
    [lines],
  );

  function updateLine(index: number, patch: Partial<EmptySaleLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  function reset() {
    setCustomerId("");
    setTransactionDate("");
    setRemarks("");
    setLines([{ ...blankLine }]);
    setPrintDocumentNo("");
  }

  function payload() {
    if (!customerId) throw new Error("Customer is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = numberValue(line.quantity);
      const unitPrice = numberValue(line.unitPrice);
      const gstPercent = numberValue(line.gstPercent);
      if (!line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: quantity must be a positive integer.`);
      if (unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price must be positive.`);
      if (gstPercent < 0) throw new Error(`Line ${index + 1}: GST % cannot be negative.`);
      return { itemId: line.itemId, quantity, unitPrice, gstPercent };
    });
    return { customerId, transactionDate, remarks, lines: preparedLines };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const result = await apiPost<Record<string, unknown>>("/api/sale-purchase/empty-sale", payload());
      const issueNo = String(result.issueNo ?? "saved");
      setSuccess(`Saved ${issueNo}.`);
      if (result.ids && issueNo !== "saved") setPrintDocumentNo(issueNo);
      setCustomerId("");
      setTransactionDate("");
      setRemarks("");
      setLines([{ ...blankLine }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Empty Sale" description="Sell empty cylinders with one issue number, empty stock OUT, customer receivable voucher, GST payable, audit trail, and printable invoice." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {printDocumentNo ? (
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
            Issue number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`/sale-purchase/empty-sale/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-blue-700 underline">
              Open printable view
            </Link>
          </div>
        ) : null}

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Sale Header</div>
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block text-sm text-slate-700 lg:col-span-2">
              <span className="mb-1 block font-medium">Customer *</span>
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
              <span className="mb-1 block font-medium">Date *</span>
              <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Remarks</span>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Empty Sale Lines</div>
            <button type="button" onClick={() => setLines((current) => [...current, { ...blankLine }])} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[960px] border-collapse text-sm">
              <thead className="bg-blue-50 text-left text-blue-950">
                <tr>
                  <th className="border border-blue-100 px-2 py-2">Item</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Quantity</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Unit Price</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">GST %</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">GST Amount</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Total Amount</th>
                  <th className="border border-blue-100 px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const current = lineTotals(line);
                  return (
                    <tr key={index}>
                      <td className="border border-blue-100 px-2 py-2">
                        <select value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value })} disabled={lookupLoading} className="w-64 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                          <option value="">Select Item</option>
                          {items.map((item) => (
                            <option key={String(item.id)} value={String(item.id)}>
                              {optionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.gstPercent} onChange={(event) => updateLine(index, { gstPercent: event.target.value })} className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2 text-right tabular-nums">{money(current.gstAmount)}</td>
                      <td className="border border-blue-100 px-2 py-2 text-right font-semibold tabular-nums">{money(current.incGstAmount)}</td>
                      <td className="border border-blue-100 px-2 py-2">
                        <button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md bg-blue-50 p-3 text-blue-950">
              <div className="text-xs font-semibold uppercase">Ex-GST Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.exGstAmount)}</div>
            </div>
            <div className="rounded-md bg-blue-50 p-3 text-blue-950">
              <div className="text-xs font-semibold uppercase">GST Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.gstAmount)}</div>
            </div>
            <div className="rounded-md bg-blue-700 p-3 text-white">
              <div className="text-xs font-semibold uppercase">Sale Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.incGstAmount)}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Empty Sale</SubmitButton>
          <button type="button" onClick={reset} className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
