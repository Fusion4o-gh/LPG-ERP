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
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">Return number: <span className="font-semibold text-slate-900">{printDocumentNo}</span></span>
            <Link href={`/returns/${printType}/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        {/* Return Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Return Header</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className="form-label" htmlFor="vendorId">Vendor *</label>
                <select id="vendorId" value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => <option key={String(v.id)} value={String(v.id)}>{optionLabel(v)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="transactionDate">Date *</label>
                <input id="transactionDate" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="remarks">Remarks</label>
                <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
              </div>
            </div>
          </div>
        </section>

        {/* Return Lines */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Return Lines</h2>
            </div>
            <button type="button" onClick={() => setLines((c) => [...c, emptyLine(kind)])} className="btn-primary-sm">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item</th>
                  {kind === "Other" && <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Account</th>}
                  {kind === "Other" && <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>}
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Unit Price</th>
                  {kind === "Other" && <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>}
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">GST %</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">GST Amt</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => {
                  const current = lineTotals(line, kind);
                  return (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-2.5 py-2">
                        <select value={line.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value })} disabled={lookupLoading} className="tbl-select w-48">
                          <option value="">{kind === "Cylinder" ? "Select Item" : "Optional Item"}</option>
                          {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                        </select>
                      </td>
                      {kind === "Other" && (
                        <td className="px-2.5 py-2">
                          <select value={line.accountId} onChange={(e) => updateLine(index, { accountId: e.target.value })} disabled={lookupLoading} className="tbl-select w-56">
                            <option value="">Use Stock Account</option>
                            {accounts.map((a) => <option key={String(a.id)} value={String(a.id)}>{optionLabel(a)}</option>)}
                          </select>
                        </td>
                      )}
                      {kind === "Other" && (
                        <td className="px-2.5 py-2">
                          <input value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} className="tbl-input w-48" />
                        </td>
                      )}
                      <td className="px-2.5 py-2"><input type="number" min={kind === "Cylinder" ? "1" : "0"} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="tbl-input w-20 text-right" /></td>
                      <td className="px-2.5 py-2"><input type="number" min="0" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} className="tbl-input w-24 text-right" /></td>
                      {kind === "Other" && (
                        <td className="px-2.5 py-2"><input type="number" min="0" value={line.amount} onChange={(e) => updateLine(index, { amount: e.target.value })} className="tbl-input w-24 text-right" /></td>
                      )}
                      <td className="px-2.5 py-2"><input type="number" min="0" value={line.gstPercent} onChange={(e) => updateLine(index, { gstPercent: e.target.value })} className="tbl-input w-16 text-right" /></td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{money(current.gstAmount)}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums font-medium text-slate-800">{money(current.totalAmount)}</td>
                      <td className="px-2.5 py-2">
                        <button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ex-GST Total</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.exGstAmount)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">GST Total</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.gstAmount)}</div>
            </div>
            <div className="rounded-lg bg-blue-700 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Return Total</div>
              <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(totals.totalAmount)}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Return</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
