"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type PurchaseLine = {
  itemId: string;
  cylinderState: "FILLED" | "EMPTY";
  quantity: string;
  unitCost: string;
  gstPercent: string;
  emptyReturnQuantity: string;
};

const emptyLine: PurchaseLine = {
  itemId: "",
  cylinderState: "FILLED",
  quantity: "1",
  unitCost: "",
  gstPercent: "0",
  emptyReturnQuantity: "0",
};

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function amount(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineTotals(line: PurchaseLine) {
  const exGstAmount = amount(line.quantity) * amount(line.unitCost);
  const gstAmount = exGstAmount * (amount(line.gstPercent) / 100);
  return { exGstAmount, gstAmount, incGstAmount: exGstAmount + gstAmount };
}

function money(value: number) {
  return value.toFixed(2);
}

export function PurchaseFilledCylinderForm() {
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [elevenPointEightKgPrice, setElevenPointEightKgPrice] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([{ ...emptyLine }]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");

  useEffect(() => {
    Promise.all([apiGet<{ vendors: Lookup[] }>("/api/vendors"), apiGet<{ items: Lookup[] }>("/api/items")])
      .then(([vendorData, itemData]) => {
        setVendors(vendorData.vendors);
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

  function updateLine(index: number, patch: Partial<PurchaseLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  function reset() {
    setVendorId("");
    setTransactionDate("");
    setRemarks("");
    setElevenPointEightKgPrice("");
    setLines([{ ...emptyLine }]);
    setPrintDocumentNo("");
  }

  function payload() {
    if (!vendorId) throw new Error("Vendor is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = amount(line.quantity);
      const unitCost = amount(line.unitCost);
      const gstPercent = amount(line.gstPercent);
      const emptyReturnQuantity = amount(line.emptyReturnQuantity);
      if (!line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: received quantity must be a positive integer.`);
      if (unitCost <= 0) throw new Error(`Line ${index + 1}: unit price must be positive.`);
      if (gstPercent < 0) throw new Error(`Line ${index + 1}: GST % cannot be negative.`);
      if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`Line ${index + 1}: empty return quantity must be a non-negative integer.`);
      return {
        itemId: line.itemId,
        cylinderState: line.cylinderState,
        quantity,
        unitCost,
        gstPercent,
        emptyReturnQuantity,
      };
    });
    return {
      vendorId,
      transactionDate,
      remarks,
      elevenPointEightKgPrice: elevenPointEightKgPrice ? Number(elevenPointEightKgPrice) : undefined,
      lines: preparedLines,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const result = await apiPost<Record<string, unknown>>("/api/purchases/filled-cylinder", payload());
      const issueNo = String(result.issueNo ?? "saved");
      setSuccess(`Saved ${issueNo}.`);
      if (result.ids && issueNo !== "saved") setPrintDocumentNo(issueNo);
      setVendorId("");
      setTransactionDate("");
      setRemarks("");
      setElevenPointEightKgPrice("");
      setLines([{ ...emptyLine }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Purchase Filled Cylinder" description="Create a legacy-style multi-line GIRN with one receipt number, stock entries per line, aggregate vendor payable voucher, GST totals, and empty return handling." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {printDocumentNo ? (
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
            Document number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`/operations/purchase-filled-cylinder/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-blue-700 underline">
              Open printable view
            </Link>
          </div>
        ) : null}

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">GIRN Header</div>
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Vendor *</span>
              <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} disabled={lookupLoading} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                <option value="">Select Vendor</option>
                {vendors.map((vendor) => (
                  <option key={String(vendor.id)} value={String(vendor.id)}>
                    {optionLabel(vendor)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Date *</span>
              <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">11.8 KG Price</span>
              <input type="number" min="0" value={elevenPointEightKgPrice} onChange={(event) => setElevenPointEightKgPrice(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700 lg:col-span-1">
              <span className="mb-1 block font-medium">Remarks</span>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Purchase Lines</div>
            <button type="button" onClick={() => setLines((current) => [...current, { ...emptyLine }])} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] border-collapse text-sm">
              <thead className="bg-blue-50 text-left text-blue-950">
                <tr>
                  <th className="border border-blue-100 px-2 py-2">Item</th>
                  <th className="border border-blue-100 px-2 py-2">Type</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Received Qty</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Unit Price</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">GST %</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Empty Return</th>
                  <th className="border border-blue-100 px-2 py-2">Empty Stock</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">GST Amount</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Ex-GST</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Inc-GST</th>
                  <th className="border border-blue-100 px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const current = lineTotals(line);
                  return (
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
                        <select value={line.cylinderState} onChange={(event) => updateLine(index, { cylinderState: event.target.value as PurchaseLine["cylinderState"] })} className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                          <option value="FILLED">Filled</option>
                          <option value="EMPTY">Empty</option>
                        </select>
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.gstPercent} onChange={(event) => updateLine(index, { gstPercent: event.target.value })} className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.emptyReturnQuantity} onChange={(event) => updateLine(index, { emptyReturnQuantity: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2 text-xs text-slate-500">Checked on save</td>
                      <td className="border border-blue-100 px-2 py-2 text-right tabular-nums">{money(current.gstAmount)}</td>
                      <td className="border border-blue-100 px-2 py-2 text-right tabular-nums">{money(current.exGstAmount)}</td>
                      <td className="border border-blue-100 px-2 py-2 text-right tabular-nums">{money(current.incGstAmount)}</td>
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
              <div className="text-xs font-semibold uppercase">Inc-GST Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.incGstAmount)}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Purchase</SubmitButton>
          <button type="button" onClick={reset} className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
