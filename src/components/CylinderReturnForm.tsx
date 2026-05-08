"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type ReturnLine = {
  itemId: string;
  returnType: "Empty" | "Filled";
  quantity: string;
  unitPrice: string;
  gstPercent: string;
};

const emptyLine: ReturnLine = { itemId: "", returnType: "Empty", quantity: "1", unitPrice: "", gstPercent: "0" };

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function amount(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineTotal(line: ReturnLine) {
  if (line.returnType !== "Filled") return 0;
  const exGstAmount = amount(line.quantity) * amount(line.unitPrice);
  return exGstAmount + exGstAmount * (amount(line.gstPercent) / 100);
}

function money(value: number) {
  return value.toFixed(2);
}

export function CylinderReturnForm() {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([{ ...emptyLine }]);
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

  const total = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);

  function updateLine(index: number, patch: Partial<ReturnLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  function reset() {
    setCustomerId("");
    setTransactionDate("");
    setRemarks("");
    setLines([{ ...emptyLine }]);
    setPrintDocumentNo("");
  }

  function payload() {
    if (!customerId) throw new Error("Customer is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = amount(line.quantity);
      const unitPrice = amount(line.unitPrice);
      const gstPercent = amount(line.gstPercent);
      if (!line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: return quantity must be a positive integer.`);
      if (line.returnType === "Filled" && unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price is required for filled return.`);
      if (gstPercent < 0) throw new Error(`Line ${index + 1}: GST % cannot be negative.`);
      return { itemId: line.itemId, returnType: line.returnType, quantity, unitPrice: line.returnType === "Filled" ? unitPrice : undefined, gstPercent: line.returnType === "Filled" ? gstPercent : undefined };
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
      const result = await apiPost<Record<string, unknown>>("/api/returns/cylinder", payload());
      const returnNo = String(result.returnNo ?? "saved");
      setSuccess(`Saved ${returnNo}.`);
      if (result.ids && returnNo !== "saved") setPrintDocumentNo(returnNo);
      setCustomerId("");
      setTransactionDate("");
      setRemarks("");
      setLines([{ ...emptyLine }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Cylinder Return" description="Receive legacy empty or filled cylinder returns with one return number, stock movement, customer cylinder balance update, and filled-return customer credit voucher." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {printDocumentNo ? (
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
            Return number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`/operations/cylinder-return/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-blue-700 underline">
              Open printable view
            </Link>
          </div>
        ) : null}

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Return Header</div>
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
            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Return Lines</div>
            <button type="button" onClick={() => setLines((current) => [...current, { ...emptyLine }])} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[940px] border-collapse text-sm">
              <thead className="bg-blue-50 text-left text-blue-950">
                <tr>
                  <th className="border border-blue-100 px-2 py-2">Item</th>
                  <th className="border border-blue-100 px-2 py-2">Return Type</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Return Qty</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Unit Price</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">GST %</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Total</th>
                  <th className="border border-blue-100 px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="border border-blue-100 px-2 py-2">
                      <select value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value })} disabled={lookupLoading} className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                        <option value="">Select Item</option>
                        {items.map((item) => (
                          <option key={String(item.id)} value={String(item.id)}>
                            {optionLabel(item)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-blue-100 px-2 py-2">
                      <select value={line.returnType} onChange={(event) => updateLine(index, { returnType: event.target.value as ReturnLine["returnType"] })} className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                        <option value="Empty">Empty</option>
                        <option value="Filled">Filled</option>
                      </select>
                    </td>
                    <td className="border border-blue-100 px-2 py-2">
                      <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                    </td>
                    <td className="border border-blue-100 px-2 py-2">
                      <input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} disabled={line.returnType === "Empty"} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right disabled:bg-slate-100" />
                    </td>
                    <td className="border border-blue-100 px-2 py-2">
                      <input type="number" min="0" value={line.gstPercent} onChange={(event) => updateLine(index, { gstPercent: event.target.value })} disabled={line.returnType === "Empty"} className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right disabled:bg-slate-100" />
                    </td>
                    <td className="border border-blue-100 px-2 py-2 text-right font-semibold tabular-nums">{money(lineTotal(line))}</td>
                    <td className="border border-blue-100 px-2 py-2">
                      <button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-md bg-blue-700 p-3 text-sm text-white">
            <div className="text-xs font-semibold uppercase">Filled Return Total</div>
            <div className="mt-1 text-lg font-semibold">{money(total)}</div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Return</SubmitButton>
          <button type="button" onClick={reset} className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
