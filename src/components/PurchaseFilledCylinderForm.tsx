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
import { WarehouseSelector } from "./WarehouseSelector";

type Lookup = Record<string, unknown>;
type PurchaseLine = {
  itemId: string;
  cylinderState: "FILLED" | "EMPTY";
  quantity: string;
  unitCost: string;
  gstPercent: string;
  emptyReturnQuantity: string;
};

const STANDARD_CYLINDER_WEIGHT_KG = 11.8;
const CYLINDER_WEIGHT_TOLERANCE = 0.05;

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

function validateLine(line: PurchaseLine, label: string) {
  const quantity = amount(line.quantity);
  const unitCost = amount(line.unitCost);
  const gstPercent = amount(line.gstPercent);
  const emptyReturnQuantity = amount(line.emptyReturnQuantity);
  if (!line.itemId) throw new Error(`${label}: item is required.`);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`${label}: received quantity must be a positive integer.`);
  if (unitCost <= 0) throw new Error(`${label}: unit price must be positive.`);
  if (gstPercent < 0) throw new Error(`${label}: GST % cannot be negative.`);
  if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`${label}: empty return quantity must be a non-negative integer.`);
}

export function PurchaseFilledCylinderForm() {
  const [vendors, setVendors] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [elevenPointEightKgPrice, setElevenPointEightKgPrice] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [draft, setDraft] = useState<PurchaseLine>({ ...emptyLine });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftError, setDraftError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");
  const [previewReceiptNo, setPreviewReceiptNo] = useState("");
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [settlement, setSettlement] = useState(emptySettlement);
  const [vendorBalance, setVendorBalance] = useState<{ payableBalance: number } | null>(null);
  const [locationId, setLocationId] = useState("");
  const [lastCost, setLastCost] = useState<Record<string, string | null>>({});

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

  const itemById = useMemo(() => new Map(items.map((item) => [String(item.id), item])), [items]);

  function isStandardCylinder(itemId: string) {
    const weight = itemById.get(itemId)?.cylinderWeightKg;
    if (weight == null) return false;
    return Math.abs(Number(weight) - STANDARD_CYLINDER_WEIGHT_KG) <= CYLINDER_WEIGHT_TOLERANCE;
  }

  useEffect(() => {
    if (!elevenPointEightKgPrice || !draft.itemId || draft.unitCost) return;
    if (!isStandardCylinder(draft.itemId)) return;
    setDraft((current) => ({ ...current, unitCost: elevenPointEightKgPrice }));
  }, [elevenPointEightKgPrice, draft.itemId, draft.unitCost, itemById]);

  useEffect(() => {
    const relevantItemIds = new Set([...lines.map((line) => line.itemId), draft.itemId].filter(Boolean));
    if (!vendorId && relevantItemIds.size === 0) {
      setVendorBalance(null);
      setLastCost({});
      return;
    }
    const params = new URLSearchParams();
    if (vendorId) params.set("vendorId", vendorId);
    for (const itemId of relevantItemIds) params.append("itemId", itemId);
    apiGet<{
      vendorBalance: { payableBalance: number } | null;
      lastCost: Record<string, string | null>;
    }>(`/api/purchases/filled-cylinder/context?${params.toString()}`)
      .then((data) => {
        setVendorBalance(data.vendorBalance);
        setLastCost(data.lastCost ?? {});
      })
      .catch(() => {
        setVendorBalance(null);
        setLastCost({});
      });
  }, [vendorId, lines, draft.itemId]);

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

  function updateDraft(patch: Partial<PurchaseLine>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function addOrUpdateLine() {
    setDraftError("");
    try {
      const label = editingIndex === null ? "New line" : `Line ${editingIndex + 1}`;
      validateLine(draft, label);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Invalid line.");
      return;
    }
    if (editingIndex === null) {
      setLines((current) => [...current, draft]);
    } else {
      setLines((current) => current.map((line, index) => (index === editingIndex ? draft : line)));
      setEditingIndex(null);
    }
    setDraft({ ...emptyLine });
  }

  function editLine(index: number) {
    setDraft(lines[index]);
    setEditingIndex(index);
    setDraftError("");
  }

  function cancelEdit() {
    setDraft({ ...emptyLine });
    setEditingIndex(null);
    setDraftError("");
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
    if (editingIndex === index) cancelEdit();
  }

  function applyElevenPointEightKgPrice() {
    const price = elevenPointEightKgPrice;
    if (!price) return;
    setLines((current) => current.map((line) => (isStandardCylinder(line.itemId) ? { ...line, unitCost: price } : line)));
    if (draft.itemId && isStandardCylinder(draft.itemId)) {
      setDraft((current) => ({ ...current, unitCost: price }));
    }
  }

  function reset() {
    setVendorId("");
    setTransactionDate("");
    setRemarks("");
    setElevenPointEightKgPrice("");
    setLines([]);
    setDraft({ ...emptyLine });
    setEditingIndex(null);
    setDraftError("");
    setPrintDocumentNo("");
    setSettlement(emptySettlement());
    setVendorBalance(null);
    setLocationId("");
    setLastCost({});
  }

  function payload() {
    if (!vendorId) throw new Error("Vendor is required.");
    if (!transactionDate) throw new Error("Date is required.");
    if (lines.length === 0) throw new Error("Add at least one purchase line.");
    const preparedLines = lines.map((line, index) => {
      validateLine(line, `Line ${index + 1}`);
      return {
        itemId: line.itemId,
        cylinderState: line.cylinderState,
        quantity: amount(line.quantity),
        unitCost: amount(line.unitCost),
        gstPercent: amount(line.gstPercent),
        emptyReturnQuantity: amount(line.emptyReturnQuantity),
      };
    });
    return {
      vendorId,
      locationId: locationId || undefined,
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

  const draftTotals = lineTotals(draft);
  const draftStandardCylinder = draft.itemId ? isStandardCylinder(draft.itemId) : false;

  return (
    <>
      <PageHeader
        title="Purchase Filled Cylinder"
        description="Create a legacy-style GIRN: fill one entry row, click Add, and repeat for each item before posting."
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
            <div className="grid items-start gap-4 lg:grid-cols-5">
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
                <label className="form-label" htmlFor="locationId">Receiving Warehouse</label>
                <WarehouseSelector value={locationId} onChange={setLocationId} disabled={lookupLoading} />
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
                <div className="flex gap-1.5">
                  <input
                    id="elevenPointEightKgPrice"
                    type="number"
                    min="0"
                    value={elevenPointEightKgPrice}
                    onChange={(e) => setElevenPointEightKgPrice(e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={applyElevenPointEightKgPrice}
                    disabled={!elevenPointEightKgPrice}
                    className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors"
                    title="Push this price into all already-added 11.8 KG cylinder lines. New lines pick it up automatically."
                  >
                    Apply to Lines
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">Auto-fills new lines; Apply pushes to existing ones.</p>
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

        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {editingIndex === null ? "New Purchase Line" : `Editing Line ${editingIndex + 1}`}
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <ApiError message={draftError} />
            <div className="grid gap-3 lg:grid-cols-8 lg:items-end">
              <div className="lg:col-span-2">
                <label className="form-label">Item</label>
                <select value={draft.itemId} onChange={(e) => updateDraft({ itemId: e.target.value })} disabled={lookupLoading} className="form-input">
                  <option value="">Select Item</option>
                  {items.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {optionLabel(item)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Type</label>
                <select value={draft.cylinderState} onChange={(e) => updateDraft({ cylinderState: e.target.value as PurchaseLine["cylinderState"] })} className="form-input">
                  <option value="FILLED">Filled</option>
                  <option value="EMPTY">Empty</option>
                </select>
              </div>
              <div>
                <label className="form-label">Received Qty</label>
                <input type="number" min="1" value={draft.quantity} onChange={(e) => updateDraft({ quantity: e.target.value })} className="form-input text-right" />
              </div>
              <div>
                <label className="form-label">Unit Price</label>
                <input type="number" min="0" value={draft.unitCost} onChange={(e) => updateDraft({ unitCost: e.target.value })} className="form-input text-right" />
                {draft.itemId && lastCost[draft.itemId] ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="text-slate-500">
                      Last price: <span className="font-semibold text-blue-700">{Number(lastCost[draft.itemId]).toFixed(2)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => updateDraft({ unitCost: lastCost[draft.itemId] as string })}
                      className="rounded bg-blue-100 px-2 py-0.5 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                ) : null}
                {draftStandardCylinder ? <div className="mt-1 text-[11px] text-slate-400">Standard 11.8 KG item</div> : null}
              </div>
              <div>
                <label className="form-label">GST %</label>
                <input type="number" min="0" value={draft.gstPercent} onChange={(e) => updateDraft({ gstPercent: e.target.value })} className="form-input text-right" />
              </div>
              <div>
                <label className="form-label">Empty Return</label>
                <input type="number" min="0" value={draft.emptyReturnQuantity} onChange={(e) => updateDraft({ emptyReturnQuantity: e.target.value })} className="form-input text-right" />
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={addOrUpdateLine} className="btn-primary-sm w-full">
                  {editingIndex === null ? "+ Add" : "Update"}
                </button>
                {editingIndex !== null ? (
                  <button type="button" onClick={cancelEdit} className="btn-outline shrink-0">
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500">
              <span>GST Amt: <span className="font-semibold text-slate-700">{money(draftTotals.gstAmount)}</span></span>
              <span>Ex-GST: <span className="font-semibold text-slate-700">{money(draftTotals.exGstAmount)}</span></span>
              <span>Inc-GST: <span className="font-semibold text-slate-700">{money(draftTotals.incGstAmount)}</span></span>
            </div>
          </div>
        </section>

        <section className="card rounded-xl">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Purchase Lines ({lines.length})</h2>
          </div>
          <div className="w-full overflow-x-auto md:overflow-x-visible">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    { label: "Item", className: "w-[26%] text-left" },
                    { label: "Type", className: "w-[8%] text-left" },
                    { label: "Received Qty", className: "w-[8%] text-right" },
                    { label: "Unit Price", className: "w-[9%] text-right" },
                    { label: "GST %", className: "w-[7%] text-right" },
                    { label: "Empty Return", className: "w-[9%] text-right" },
                    { label: "GST Amt", className: "w-[8%] text-right" },
                    { label: "Ex-GST", className: "w-[8%] text-right" },
                    { label: "Inc-GST", className: "w-[9%] text-right" },
                    { label: "", className: "w-[8%] text-right" },
                  ].map((col) => (
                    <th
                      key={col.label || "actions"}
                      className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${col.className}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-400">
                      No lines added yet. Fill the entry row above and click Add.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const current = lineTotals(line);
                    const item = itemById.get(line.itemId);
                    return (
                      <tr key={index} className={`bg-white transition-colors ${editingIndex === index ? "bg-blue-50/60" : "hover:bg-blue-50/30"}`}>
                        <td className="px-2.5 py-2">{item ? optionLabel(item) : line.itemId}</td>
                        <td className="px-2.5 py-2">{line.cylinderState === "FILLED" ? "Filled" : "Empty"}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{line.quantity}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{money(amount(line.unitCost))}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{line.gstPercent}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{line.emptyReturnQuantity}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{money(current.gstAmount)}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-slate-600">{money(current.exGstAmount)}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums font-medium text-slate-800">{money(current.incGstAmount)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right">
                          <button type="button" onClick={() => editLine(index)} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">
                            Edit
                          </button>
                          <button type="button" onClick={() => removeLine(index)} className="ml-1 rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
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
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Total Bill (Inc-GST)</div>
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
          <SubmitButton loading={loading} disabled={lines.length === 0}>Post Purchase</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
