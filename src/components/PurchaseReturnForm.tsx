"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type ReturnKind = "Cylinder" | "Other";
type ReturnLine = {
  itemId: string;
  accountId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  gstPercent: string;
};

function emptyLine(kind: ReturnKind): ReturnLine {
  return { itemId: "", accountId: "", description: "", quantity: kind === "Cylinder" ? "1" : "", unitPrice: "", amount: "", gstPercent: "0" };
}

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function numberValue(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineBaseAmount(line: ReturnLine, kind: ReturnKind) {
  if (kind === "Other" && line.amount) return numberValue(line.amount);
  return numberValue(line.quantity) * numberValue(line.unitPrice);
}

function lineTotals(line: ReturnLine, kind: ReturnKind) {
  const exGstAmount = lineBaseAmount(line, kind);
  const gstAmount = exGstAmount * (numberValue(line.gstPercent) / 100);
  return { exGstAmount, gstAmount, totalAmount: exGstAmount + gstAmount };
}

function money(value: number) {
  return value.toFixed(2);
}

export function PurchaseReturnForm({ kind }: { kind: ReturnKind }) {
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [accounts, setAccounts] = useState<Lookup[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<ReturnLine[]>([emptyLine(kind)]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");

  useEffect(() => {
    Promise.all([apiGet<{ vendors: Lookup[] }>("/api/vendors"), apiGet<{ items: Lookup[] }>("/api/items"), apiGet<{ accounts: Lookup[] }>("/api/accounting/chart-of-accounts")])
      .then(([vendorData, itemData, accountData]) => {
        setVendors(vendorData.vendors);
        setItems(itemData.items);
        setAccounts(accountData.accounts);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, []);

  const totals = useMemo(
    () =>
      lines.reduce(
        (sum, line) => {
          const current = lineTotals(line, kind);
          return {
            exGstAmount: sum.exGstAmount + current.exGstAmount,
            gstAmount: sum.gstAmount + current.gstAmount,
            totalAmount: sum.totalAmount + current.totalAmount,
          };
        },
        { exGstAmount: 0, gstAmount: 0, totalAmount: 0 },
      ),
    [kind, lines],
  );

  function updateLine(index: number, patch: Partial<ReturnLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  function reset() {
    setVendorId("");
    setTransactionDate("");
    setRemarks("");
    setLines([emptyLine(kind)]);
    setPrintDocumentNo("");
  }

  function payload() {
    if (!vendorId) throw new Error("Vendor is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = numberValue(line.quantity);
      const unitPrice = numberValue(line.unitPrice);
      const amount = numberValue(line.amount);
      const gstPercent = numberValue(line.gstPercent);
      if (kind === "Cylinder" && !line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (kind === "Cylinder" && (!Number.isInteger(quantity) || quantity <= 0)) throw new Error(`Line ${index + 1}: quantity must be a positive integer.`);
      if (kind === "Cylinder" && unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price must be positive.`);
      if (kind === "Other" && !line.accountId && !line.itemId) throw new Error(`Line ${index + 1}: account or item is required.`);
      if (kind === "Other" && amount <= 0 && (!quantity || !unitPrice)) throw new Error(`Line ${index + 1}: enter amount or quantity with unit price.`);
      if (gstPercent < 0) throw new Error(`Line ${index + 1}: GST % cannot be negative.`);
      return kind === "Cylinder"
        ? { itemId: line.itemId, quantity, unitPrice, gstPercent }
        : {
            accountId: line.accountId || undefined,
            itemId: line.itemId || undefined,
            description: line.description || undefined,
            quantity: quantity || undefined,
            unitPrice: unitPrice || undefined,
            amount: amount || undefined,
            gstPercent,
          };
    });
    return { vendorId, transactionDate, remarks, returnType: kind, lines: preparedLines };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const endpoint = kind === "Cylinder" ? "/api/returns/purchase-return-cylinder" : "/api/returns/purchase-return-other";
      const result = await apiPost<Record<string, unknown>>(endpoint, payload());
      const returnNo = String(result.returnNo ?? "saved");
      setSuccess(`Saved ${returnNo}.`);
      if (result.ids && returnNo !== "saved") setPrintDocumentNo(returnNo);
      setVendorId("");
      setTransactionDate("");
      setRemarks("");
      setLines([emptyLine(kind)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  const title = kind === "Cylinder" ? "Purchase Return Cylinder" : "Purchase Return Other";
  const printType = kind === "Cylinder" ? "purchase-return-cylinder" : "purchase-return-other";

  return (
    <>
      <PageHeader title={title} description="Create a legacy-style purchase return with one return number, vendor payable adjustment, balanced voucher, and printable receipt." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {printDocumentNo ? (
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
            Return number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`/returns/${printType}/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-blue-700 underline">
              Open printable view
            </Link>
          </div>
        ) : null}

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Return Header</div>
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="block text-sm text-slate-700 lg:col-span-2">
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
              <span className="mb-1 block font-medium">Remarks</span>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Return Lines</div>
            <button type="button" onClick={() => setLines((current) => [...current, emptyLine(kind)])} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] border-collapse text-sm">
              <thead className="bg-blue-50 text-left text-blue-950">
                <tr>
                  <th className="border border-blue-100 px-2 py-2">Item</th>
                  {kind === "Other" ? <th className="border border-blue-100 px-2 py-2">Account</th> : null}
                  {kind === "Other" ? <th className="border border-blue-100 px-2 py-2">Description</th> : null}
                  <th className="border border-blue-100 px-2 py-2 text-right">Quantity</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Unit Price</th>
                  {kind === "Other" ? <th className="border border-blue-100 px-2 py-2 text-right">Amount</th> : null}
                  <th className="border border-blue-100 px-2 py-2 text-right">GST %</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">GST Amount</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Total</th>
                  <th className="border border-blue-100 px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const current = lineTotals(line, kind);
                  return (
                    <tr key={index}>
                      <td className="border border-blue-100 px-2 py-2">
                        <select value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value })} disabled={lookupLoading} className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                          <option value="">{kind === "Cylinder" ? "Select Item" : "Optional Item"}</option>
                          {items.map((item) => (
                            <option key={String(item.id)} value={String(item.id)}>
                              {optionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </td>
                      {kind === "Other" ? (
                        <td className="border border-blue-100 px-2 py-2">
                          <select value={line.accountId} onChange={(event) => updateLine(index, { accountId: event.target.value })} disabled={lookupLoading} className="w-64 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                            <option value="">Use Stock Account</option>
                            {accounts.map((account) => (
                              <option key={String(account.id)} value={String(account.id)}>
                                {optionLabel(account)}
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      {kind === "Other" ? (
                        <td className="border border-blue-100 px-2 py-2">
                          <input value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} className="w-56 rounded-md border border-slate-300 px-2 py-1.5" />
                        </td>
                      ) : null}
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min={kind === "Cylinder" ? "1" : "0"} value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      {kind === "Other" ? (
                        <td className="border border-blue-100 px-2 py-2">
                          <input type="number" min="0" value={line.amount} onChange={(event) => updateLine(index, { amount: event.target.value })} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                        </td>
                      ) : null}
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.gstPercent} onChange={(event) => updateLine(index, { gstPercent: event.target.value })} className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2 text-right tabular-nums">{money(current.gstAmount)}</td>
                      <td className="border border-blue-100 px-2 py-2 text-right font-semibold tabular-nums">{money(current.totalAmount)}</td>
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
              <div className="text-xs font-semibold uppercase">Return Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.totalAmount)}</div>
            </div>
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
