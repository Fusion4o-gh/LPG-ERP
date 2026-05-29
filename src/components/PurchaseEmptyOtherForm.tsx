"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { emptySettlement } from "@/lib/settlement";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SettlementPanel } from "./SettlementPanel";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type PurchaseKind = "EmptyCylinder" | "Other";
type PurchaseLine = {
  itemId: string;
  accountId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  gstPercent: string;
};

function emptyLine(kind: PurchaseKind): PurchaseLine {
  return { itemId: "", accountId: "", description: "", quantity: kind === "EmptyCylinder" ? "1" : "", unitPrice: "", amount: "", gstPercent: "0" };
}

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function numberValue(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineBaseAmount(line: PurchaseLine, kind: PurchaseKind) {
  if (kind === "Other" && line.amount) return numberValue(line.amount);
  return numberValue(line.quantity) * numberValue(line.unitPrice);
}

function lineTotals(line: PurchaseLine, kind: PurchaseKind) {
  const exGstAmount = lineBaseAmount(line, kind);
  const gstAmount = exGstAmount * (numberValue(line.gstPercent) / 100);
  return { exGstAmount, gstAmount, incGstAmount: exGstAmount + gstAmount };
}

function money(value: number) {
  return value.toFixed(2);
}

export function PurchaseEmptyOtherForm({ kind }: { kind: PurchaseKind }) {
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [accounts, setAccounts] = useState<Lookup[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine(kind)]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [settlement, setSettlement] = useState(emptySettlement());
  const [vendorBalance, setVendorBalance] = useState<{ payableBalance: number } | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<{ vendors: Lookup[] }>("/api/vendors"),
      apiGet<{ items: Lookup[] }>("/api/items"),
      apiGet<{ accounts: Lookup[] }>("/api/accounting/chart-of-accounts"),
      apiGet<{ banks: { id: string; name: string }[] }>("/api/banks"),
    ])
      .then(([vendorData, itemData, accountData, bankData]) => {
        setVendors(vendorData.vendors);
        setItems(itemData.items);
        setAccounts(accountData.accounts);
        setBanks(bankData.banks);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setVendorBalance(null);
      return;
    }
    apiGet<{ vendorBalance: { payableBalance: number } | null }>(`/api/purchases/filled-cylinder/context?vendorId=${vendorId}`)
      .then((data) => setVendorBalance(data.vendorBalance))
      .catch(() => setVendorBalance(null));
  }, [vendorId]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (sum, line) => {
          const current = lineTotals(line, kind);
          return { exGstAmount: sum.exGstAmount + current.exGstAmount, gstAmount: sum.gstAmount + current.gstAmount, incGstAmount: sum.incGstAmount + current.incGstAmount };
        },
        { exGstAmount: 0, gstAmount: 0, incGstAmount: 0 },
      ),
    [kind, lines],
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
    setLines([emptyLine(kind)]);
    setPrintDocumentNo("");
    setSettlement(emptySettlement());
    setVendorBalance(null);
  }

  function payload() {
    if (!vendorId) throw new Error("Vendor is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = numberValue(line.quantity);
      const unitPrice = numberValue(line.unitPrice);
      const amt = numberValue(line.amount);
      const gstPercent = numberValue(line.gstPercent);
      if (kind === "EmptyCylinder" && !line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (kind === "EmptyCylinder" && (!Number.isInteger(quantity) || quantity <= 0)) throw new Error(`Line ${index + 1}: quantity must be a positive integer.`);
      if (kind === "EmptyCylinder" && unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price must be positive.`);
      if (kind === "Other" && !line.accountId && !line.itemId && !line.description) throw new Error(`Line ${index + 1}: account, item, or description is required.`);
      if (kind === "Other" && amt <= 0 && (!quantity || !unitPrice)) throw new Error(`Line ${index + 1}: enter amount or quantity with unit price.`);
      if (gstPercent < 0) throw new Error(`Line ${index + 1}: GST % cannot be negative.`);
      return kind === "EmptyCylinder"
        ? { itemId: line.itemId, quantity, unitPrice, gstPercent }
        : { accountId: line.accountId || undefined, itemId: line.itemId || undefined, description: line.description || undefined, quantity: quantity || undefined, unitPrice: unitPrice || undefined, amount: amt || undefined, gstPercent };
    });
    return {
      vendorId,
      transactionDate,
      remarks,
      lines: preparedLines,
      discount: numberValue(settlement.discount),
      amountPaid: numberValue(settlement.amountReceived),
      payMode: settlement.receiveMode,
      bankId: settlement.bankId || undefined,
      chequeNo: settlement.chequeNo || undefined,
      chequeDate: settlement.chequeDate || undefined,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const endpoint = kind === "EmptyCylinder" ? "/api/purchases/empty-cylinder" : "/api/purchases/other";
      const result = await apiPost<Record<string, unknown>>(endpoint, payload());
      const receiptNo = String(result.receiptNo ?? result.issueNo ?? "saved");
      setSuccess(`Saved ${receiptNo}.`);
      if (result.ids && receiptNo !== "saved") setPrintDocumentNo(receiptNo);
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

  const title = kind === "EmptyCylinder" ? "Purchase Empty Cylinder" : "Purchase Other";
  const printType = kind === "EmptyCylinder" ? "purchase-empty-cylinder" : "purchase-other";

  return (
    <>
      <PageHeader title={title} description="Create a legacy-style purchase entry with one receipt number, aggregate vendor payable voucher, GST totals, audit trail, and printable receipt." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        {printDocumentNo ? (
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">Receipt number: <span className="font-semibold text-slate-900">{printDocumentNo}</span></span>
            <Link href={`/sale-purchase/${printType}/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        {/* Purchase Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Purchase Header</h2>
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
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 lg:col-span-4 lg:max-w-xs">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vendor Balance</div>
                {vendorBalance ? (
                  <div className="mt-1 text-sm font-medium tabular-nums text-slate-700">Payable: {money(vendorBalance.payableBalance)}</div>
                ) : (
                  <div className="mt-1 text-sm text-slate-500">Select vendor to load balance.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Purchase Lines */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Purchase Lines</h2>
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
                          <option value="">{kind === "EmptyCylinder" ? "Select Item" : "Optional Item"}</option>
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
                      <td className="px-2.5 py-2"><input type="number" min={kind === "EmptyCylinder" ? "1" : "0"} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="tbl-input w-20 text-right" /></td>
                      <td className="px-2.5 py-2"><input type="number" min="0" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} className="tbl-input w-24 text-right" /></td>
                      {kind === "Other" && (
                        <td className="px-2.5 py-2"><input type="number" min="0" value={line.amount} onChange={(e) => updateLine(index, { amount: e.target.value })} className="tbl-input w-24 text-right" /></td>
                      )}
                      <td className="px-2.5 py-2"><input type="number" min="0" value={line.gstPercent} onChange={(e) => updateLine(index, { gstPercent: e.target.value })} className="tbl-input w-16 text-right" /></td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{money(current.gstAmount)}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums font-medium text-slate-800">{money(current.incGstAmount)}</td>
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
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Purchase Total</div>
              <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(totals.incGstAmount)}</div>
            </div>
          </div>
        </section>

        <SettlementPanel
          variant="payment"
          totalBill={totals.incGstAmount}
          fields={settlement}
          onChange={(patch) => setSettlement((current) => ({ ...current, ...patch }))}
          banks={banks}
        />

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Purchase</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
