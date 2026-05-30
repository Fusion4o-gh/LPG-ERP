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
  const [previewReceiptNo, setPreviewReceiptNo] = useState("");
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [settlement, setSettlement] = useState(emptySettlement);
  const [vendorBalance, setVendorBalance] = useState<{ payableBalance: number } | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<{ vendors: Lookup[] }>("/api/vendors"),
      apiGet<{ items: Lookup[] }>("/api/items"),
      apiGet<{ banks: { id: string; name: string }[] }>("/api/banks"),
      apiGet<{ documentNo: string }>("/api/documents/next-number?kind=purchase-receipt"),
    ])
      .then(([vendorData, itemData, bankData, preview]) => {
        setVendors(vendorData.vendors);
        setItems(itemData.items);
        setBanks(bankData.banks);
        setPreviewReceiptNo(preview.documentNo);
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
    setSettlement(emptySettlement());
    setVendorBalance(null);
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
      return { itemId: line.itemId, cylinderState: line.cylinderState, quantity, unitCost, gstPercent, emptyReturnQuantity };
    });
    return {
      vendorId,
      transactionDate,
      remarks,
      elevenPointEightKgPrice: elevenPointEightKgPrice ? Number(elevenPointEightKgPrice) : undefined,
      lines: preparedLines,
      discount: amount(settlement.discount),
      amountPaid: amount(settlement.amountReceived),
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
      const result = await apiPost<Record<string, unknown>>("/api/purchases/filled-cylinder", payload());
      const issueNo = String(result.issueNo ?? "saved");
      setSuccess(`Saved ${issueNo}.`);
      if (result.ids && issueNo !== "saved") setPrintDocumentNo(issueNo);
      reset();
      apiGet<{ documentNo: string }>("/api/documents/next-number?kind=purchase-receipt")
        .then((preview) => setPreviewReceiptNo(preview.documentNo))
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Purchase Filled Cylinder"
        description="Create a legacy-style multi-line GIRN with settlement, vendor balance, and payable vouchers."
        actions={
          previewReceiptNo ? (
            <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              Next Receipt #: {previewReceiptNo}
            </span>
          ) : null
        }
      />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        {printDocumentNo ? (
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">
              Receipt number: <span className="font-semibold text-slate-900">{printDocumentNo}</span>
            </span>
            <Link
              href={`/operations/purchase-filled-cylinder/print/${encodeURIComponent(printDocumentNo)}`}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Open Print View
            </Link>
          </div>
        ) : null}

        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">GIRN Header</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label className="form-label" htmlFor="vendorId">
                  Vendor *
                </label>
                <select id="vendorId" value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => (
                    <option key={String(v.id)} value={String(v.id)}>
                      {optionLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="transactionDate">
                  Date *
                </label>
                <input id="transactionDate" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="elevenPointEightKgPrice">
                  11.8 KG Price
                </label>
                <input id="elevenPointEightKgPrice" type="number" min="0" value={elevenPointEightKgPrice} onChange={(e) => setElevenPointEightKgPrice(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="remarks">
                  Remarks
                </label>
                <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 lg:col-span-5 lg:max-w-xs">
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

        <section className="card rounded-xl">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Purchase Lines</h2>
            </div>
            <button type="button" onClick={() => setLines((c) => [...c, { ...emptyLine }])} className="btn-primary-sm">
              + Add Row
            </button>
          </div>
          <div className="w-full overflow-x-auto md:overflow-x-visible">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    { label: "Item", className: "w-[30%] text-left" },
                    { label: "Type", className: "w-[9%] text-left" },
                    { label: "Received Qty", className: "w-[8%] text-right" },
                    { label: "Unit Price", className: "w-[9%] text-right" },
                    { label: "GST %", className: "w-[7%] text-right" },
                    { label: "Empty Return", className: "w-[9%] text-right" },
                    { label: "GST Amt", className: "w-[8%] text-right" },
                    { label: "Ex-GST", className: "w-[8%] text-right" },
                    { label: "Inc-GST", className: "w-[10%] text-right" },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${col.className}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => {
                  const current = lineTotals(line);
                  return (
                    <tr key={index} className="bg-white hover:bg-blue-50/30 transition-colors">
                      <td className="px-2.5 py-2">
                        <select value={line.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value })} disabled={lookupLoading} className="tbl-select w-full min-w-0">
                          <option value="">Select Item</option>
                          {items.map((item) => (
                            <option key={String(item.id)} value={String(item.id)}>
                              {optionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2">
                        <select value={line.cylinderState} onChange={(e) => updateLine(index, { cylinderState: e.target.value as PurchaseLine["cylinderState"] })} className="tbl-select w-full min-w-0">
                          <option value="FILLED">Filled</option>
                          <option value="EMPTY">Empty</option>
                        </select>
                      </td>
                      <td className="px-2.5 py-2">
                        <input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="tbl-input w-full min-w-0 text-right" />
                      </td>
                      <td className="px-2.5 py-2">
                        <input type="number" min="0" value={line.unitCost} onChange={(e) => updateLine(index, { unitCost: e.target.value })} className="tbl-input w-full min-w-0 text-right" />
                      </td>
                      <td className="px-2.5 py-2">
                        <input type="number" min="0" value={line.gstPercent} onChange={(e) => updateLine(index, { gstPercent: e.target.value })} className="tbl-input w-full min-w-0 text-right" />
                      </td>
                      <td className="px-2.5 py-2">
                        <input type="number" min="0" value={line.emptyReturnQuantity} onChange={(e) => updateLine(index, { emptyReturnQuantity: e.target.value })} className="tbl-input w-full min-w-0 text-right" />
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{money(current.gstAmount)}</td>
                      <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{money(current.exGstAmount)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <span className="tabular-nums font-medium text-slate-800">{money(current.incGstAmount)}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={lines.length === 1}
                          className="ml-3 inline-flex rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          Remove
                        </button>
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
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Inc-GST Total</div>
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
          <button type="button" onClick={reset} className="btn-outline">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
