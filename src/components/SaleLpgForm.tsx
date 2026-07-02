"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { emptySettlement } from "@/lib/settlement";
import { ApiError } from "./ApiError";
import { KgPriceField } from "./KgPriceField";
import { PageHeader } from "./PageHeader";
import { SettlementPanel } from "./SettlementPanel";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";
import { WarehouseSelector } from "./WarehouseSelector";

const STANDARD_CYLINDER_WEIGHT_KG = 11.8;
const CYLINDER_WEIGHT_TOLERANCE = 0.05;

type Lookup = Record<string, unknown>;
type SaleLine = {
  itemId: string;
  quantity: string;
  unitPrice: string;
  securityDepositAmount: string;
  emptyReturnItemId: string;
  emptyReturnQuantity: string;
};

const emptyLine: SaleLine = {
  itemId: "",
  quantity: "1",
  unitPrice: "",
  securityDepositAmount: "0",
  emptyReturnItemId: "",
  emptyReturnQuantity: "0",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function amount(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineTotals(line: SaleLine) {
  const lineAmount = amount(line.quantity) * amount(line.unitPrice);
  const securityAmount = amount(line.securityDepositAmount);
  return { amount: lineAmount, securityAmount, receivableAmount: lineAmount + securityAmount };
}

function money(value: number) {
  return value.toFixed(2);
}

function estimatedMargin(estimatedCost: string | null | undefined, unitPrice: number) {
  const cost = estimatedCost != null ? Number(estimatedCost) : null;
  if (cost == null || !Number.isFinite(cost) || unitPrice <= 0) return null;
  const marginAmount = unitPrice - cost;
  const marginPercent = (marginAmount / unitPrice) * 100;
  return { estimatedCost: cost, marginAmount, marginPercent };
}

function validateLine(line: SaleLine, label: string) {
  const quantity = amount(line.quantity);
  const unitPrice = amount(line.unitPrice);
  const securityDepositAmount = amount(line.securityDepositAmount);
  const emptyReturnQuantity = amount(line.emptyReturnQuantity);
  if (!line.itemId) throw new Error(`${label}: item is required.`);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`${label}: sale quantity must be a positive integer.`);
  if (unitPrice <= 0) throw new Error(`${label}: unit price must be positive.`);
  if (securityDepositAmount < 0) throw new Error(`${label}: security amount cannot be negative.`);
  if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`${label}: return quantity must be a non-negative integer.`);
}

export function SaleLpgForm() {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [transactionDate, setTransactionDate] = useState(today);
  const [saleType, setSaleType] = useState("Direct");
  const [remarks, setRemarks] = useState("");
  const [elevenPointEightKgPrice, setElevenPointEightKgPrice] = useState("");
  const [invoiceLanguage, setInvoiceLanguage] = useState("English");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [draft, setDraft] = useState<SaleLine>({ ...emptyLine });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftError, setDraftError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");
  const [previewIssueNo, setPreviewIssueNo] = useState("");
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [settlement, setSettlement] = useState(emptySettlement);
  const [gasReturn, setGasReturn] = useState({ returnGasKg: "", rate: "" });
  const [customerBalance, setCustomerBalance] = useState<{
    receivableBalance: number;
    emptyOwed: number;
    filledOutstanding: number;
  } | null>(null);
  const [filledStock, setFilledStock] = useState<Record<string, number>>({});
  const [locationId, setLocationId] = useState("");
  const [kgPricing, setKgPricing] = useState<Record<string, { unitPrice: string; pricePerKg: string | null; cylinderWeightKg: string | null; usingKgPricing: boolean } | null>>({});
  const [estimatedCost, setEstimatedCost] = useState<Record<string, string | null>>({});

  useEffect(() => {
    Promise.all([
      apiGet<{ customers: Lookup[] }>("/api/customers"),
      apiGet<{ items: Lookup[] }>("/api/items"),
      apiGet<{ banks: { id: string; name: string }[] }>("/api/banks"),
      apiGet<{ documentNo: string }>("/api/documents/next-number?kind=sale-issue"),
    ])
      .then(([customerData, itemData, bankData, preview]) => {
        setCustomers(customerData.customers);
        setItems(itemData.items);
        setBanks(bankData.banks);
        setPreviewIssueNo(preview.documentNo);
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
    if (!elevenPointEightKgPrice || !draft.itemId || draft.unitPrice) return;
    if (!isStandardCylinder(draft.itemId)) return;
    setDraft((current) => ({ ...current, unitPrice: elevenPointEightKgPrice }));
  }, [elevenPointEightKgPrice, draft.itemId, draft.unitPrice, itemById]);

  useEffect(() => {
    const relevantItemIds = new Set([...lines.map((line) => line.itemId), draft.itemId].filter(Boolean));
    if (!customerId && relevantItemIds.size === 0) {
      setCustomerBalance(null);
      setFilledStock({});
      return;
    }
    const params = new URLSearchParams();
    if (customerId) params.set("customerId", customerId);
    for (const itemId of relevantItemIds) params.append("itemId", itemId);
    apiGet<{
      customerBalance: { receivableBalance: number; emptyOwed: number; filledOutstanding: number } | null;
      filledStock: Record<string, number>;
      kgPricing: Record<string, { unitPrice: string; pricePerKg: string | null; cylinderWeightKg: string | null; usingKgPricing: boolean } | null>;
      estimatedCost: Record<string, string | null>;
    }>(`/api/sales/lpg/context?${params.toString()}`)
      .then((data) => {
        setCustomerBalance(data.customerBalance);
        setFilledStock(data.filledStock);
        setKgPricing(data.kgPricing ?? {});
        setEstimatedCost(data.estimatedCost ?? {});
      })
      .catch(() => {
        setCustomerBalance(null);
        setFilledStock({});
        setKgPricing({});
        setEstimatedCost({});
      });
  }, [customerId, lines, draft.itemId]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (sum, line) => {
          const current = lineTotals(line);
          return { amount: sum.amount + current.amount, securityAmount: sum.securityAmount + current.securityAmount, receivableAmount: sum.receivableAmount + current.receivableAmount };
        },
        { amount: 0, securityAmount: 0, receivableAmount: 0 },
      ),
    [lines],
  );

  function updateDraft(patch: Partial<SaleLine>) {
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
    const preparedDraft = { ...draft, emptyReturnItemId: draft.emptyReturnItemId || draft.itemId };
    if (editingIndex === null) {
      setLines((current) => [...current, preparedDraft]);
    } else {
      setLines((current) => current.map((line, index) => (index === editingIndex ? preparedDraft : line)));
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

  function reset() {
    setCustomerId("");
    setTransactionDate(today());
    setSaleType("Direct");
    setRemarks("");
    setElevenPointEightKgPrice("");
    setInvoiceLanguage("English");
    setLines([]);
    setDraft({ ...emptyLine });
    setEditingIndex(null);
    setDraftError("");
    setPrintDocumentNo("");
    setSettlement(emptySettlement());
    setGasReturn({ returnGasKg: "", rate: "" });
    setCustomerBalance(null);
    setFilledStock({});
    setLocationId("");
    setKgPricing({});
  }

  function payload() {
    if (!customerId) throw new Error("Customer is required.");
    if (!transactionDate) throw new Error("Date is required.");
    if (lines.length === 0) throw new Error("Add at least one sale line.");
    const preparedLines = lines.map((line, index) => {
      validateLine(line, `Line ${index + 1}`);
      return {
        itemId: line.itemId,
        quantity: amount(line.quantity),
        unitPrice: amount(line.unitPrice),
        securityDepositAmount: amount(line.securityDepositAmount),
        emptyReturnItemId: line.emptyReturnItemId || line.itemId,
        emptyReturnQuantity: amount(line.emptyReturnQuantity),
      };
    });
    return {
      customerId,
      locationId: locationId || undefined,
      transactionDate,
      saleType,
      remarks,
      elevenPointEightKgPrice: elevenPointEightKgPrice ? Number(elevenPointEightKgPrice) : undefined,
      invoiceLanguage,
      lines: preparedLines,
      discount: amount(settlement.discount),
      amountReceived: amount(settlement.amountReceived),
      receiveMode: settlement.receiveMode,
      bankId: settlement.bankId || undefined,
      chequeNo: settlement.chequeNo || undefined,
      chequeDate: settlement.chequeDate || undefined,
      returnGasKg: amount(gasReturn.returnGasKg) || undefined,
      gasReturnRate: amount(gasReturn.rate) || undefined,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      const result = await apiPost<Record<string, unknown>>("/api/sales/lpg", payload());
      const issueNo = String(result.issueNo ?? "saved");
      setSuccess(`Saved ${issueNo}.`);
      if (result.ids && issueNo !== "saved") setPrintDocumentNo(issueNo);
      reset();
      apiGet<{ documentNo: string }>("/api/documents/next-number?kind=sale-issue")
        .then((preview) => setPreviewIssueNo(preview.documentNo))
        .catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  const draftTotals = lineTotals(draft);
  const draftMargin = estimatedMargin(estimatedCost[draft.itemId], amount(draft.unitPrice));

  return (
    <>
      <PageHeader
        title="Sale LPG"
        description="Create a legacy-style LPG invoice: fill one entry line, click Add, and repeat for each item before posting."
        actions={
          previewIssueNo ? (
            <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              Next Issue #: {previewIssueNo}
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
            <span className="text-slate-600">Issue number: <span className="font-semibold text-slate-900">{printDocumentNo}</span></span>
            <Link href={`/operations/sale-lpg/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        {/* Invoice Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Invoice Header</h2>
          </div>
          <div className="p-5">
            <div className="grid items-start gap-4 lg:grid-cols-6">
              <div className="lg:col-span-2">
                <label className="form-label" htmlFor="customerId">Customer *</label>
                <select id="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Customer</option>
                  {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{optionLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="locationId">Dispatch Warehouse</label>
                <WarehouseSelector value={locationId} onChange={setLocationId} disabled={lookupLoading} />
              </div>
              <div>
                <label className="form-label" htmlFor="transactionDate">Date *</label>
                <input id="transactionDate" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="saleType">Sale Type</label>
                <select id="saleType" value={saleType} onChange={(e) => setSaleType(e.target.value)} className="form-input">
                  <option value="Direct">Direct</option>
                  <option value="From Gasable">From Gasable</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="elevenPointEightKgPrice">11.8 KG Price</label>
                <input id="elevenPointEightKgPrice" type="number" min="0" value={elevenPointEightKgPrice} onChange={(e) => setElevenPointEightKgPrice(e.target.value)} className="form-input" />
                <p className="mt-1 text-[11px] leading-snug text-slate-400">Auto-fills new 11.8 KG lines.</p>
              </div>
              <div>
                <label className="form-label" htmlFor="invoiceLanguage">Invoice Language</label>
                <select id="invoiceLanguage" value={invoiceLanguage} onChange={(e) => setInvoiceLanguage(e.target.value)} className="form-input">
                  <option value="English">English</option>
                  <option value="Urdu">Urdu</option>
                </select>
              </div>
              <div className="lg:col-span-4">
                <label className="form-label" htmlFor="remarks">Remarks</label>
                <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 lg:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Customer Balance</div>
                {customerBalance ? (
                  <div className="mt-1 space-y-0.5 text-sm text-slate-700 tabular-nums">
                    <div>Receivable: {money(customerBalance.receivableBalance)}</div>
                    <div>Empty owed: {customerBalance.emptyOwed}</div>
                    <div>Cylinders out: {customerBalance.filledOutstanding}</div>
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-slate-500">Select customer to load balance.</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Entry Line */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {editingIndex === null ? "New Sale Line" : `Editing Line ${editingIndex + 1}`}
            </h2>
          </div>
          <div className="p-5 space-y-3">
            <ApiError message={draftError} />
            <div className="grid gap-3 lg:grid-cols-7 lg:items-end">
              <div className="lg:col-span-2">
                <label className="form-label">Item</label>
                <select
                  value={draft.itemId}
                  onChange={(e) => updateDraft({ itemId: e.target.value, emptyReturnItemId: draft.emptyReturnItemId || e.target.value })}
                  disabled={lookupLoading}
                  className="form-input"
                >
                  <option value="">Select Item</option>
                  {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                </select>
                <div className="mt-1 text-[11px] text-slate-400">
                  Filled stock: <span className="font-semibold text-slate-600">{draft.itemId ? filledStock[draft.itemId] ?? 0 : "—"}</span>
                </div>
              </div>
              <div>
                <label className="form-label">Sale Qty</label>
                <input type="number" min="1" value={draft.quantity} onChange={(e) => updateDraft({ quantity: e.target.value })} className="form-input text-right" />
              </div>
              <div>
                <label className="form-label">Unit Price</label>
                <input type="number" min="0" value={draft.unitPrice} onChange={(e) => updateDraft({ unitPrice: e.target.value })} className="form-input text-right" />
                {draft.itemId && kgPricing[draft.itemId] ? (
                  <KgPriceField
                    pricePerKg={kgPricing[draft.itemId]?.pricePerKg ? Number(kgPricing[draft.itemId]!.pricePerKg) : null}
                    cylinderWeightKg={kgPricing[draft.itemId]?.cylinderWeightKg ? Number(kgPricing[draft.itemId]!.cylinderWeightKg) : null}
                    quantity={amount(draft.quantity)}
                    unitPrice={amount(draft.unitPrice)}
                    onUnitPriceChange={(price) => updateDraft({ unitPrice: String(price) })}
                  />
                ) : null}
                {draftMargin ? (
                  <div className="mt-1 text-xs text-slate-500">
                    Est. cost <span className="font-semibold text-slate-700">{money(draftMargin.estimatedCost)}</span>
                    {" "}&middot; margin{" "}
                    <span className={draftMargin.marginAmount >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
                      {money(draftMargin.marginAmount)} ({draftMargin.marginPercent.toFixed(1)}%)
                    </span>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="form-label">Security</label>
                <input type="number" min="0" value={draft.securityDepositAmount} onChange={(e) => updateDraft({ securityDepositAmount: e.target.value })} className="form-input text-right" />
              </div>
              <div>
                <label className="form-label">Empty Return Item</label>
                <select value={draft.emptyReturnItemId} onChange={(e) => updateDraft({ emptyReturnItemId: e.target.value })} disabled={lookupLoading} className="form-input">
                  <option value="">Same as sale item</option>
                  {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Return Qty</label>
                <input type="number" min="0" value={draft.emptyReturnQuantity} onChange={(e) => updateDraft({ emptyReturnQuantity: e.target.value })} className="form-input text-right" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                <span>Amount: <span className="font-semibold text-slate-700">{money(draftTotals.amount)}</span></span>
                <span>Security: <span className="font-semibold text-slate-700">{money(draftTotals.securityAmount)}</span></span>
                <span>Receivable: <span className="font-semibold text-slate-700">{money(draftTotals.receivableAmount)}</span></span>
              </div>
              <div className="ml-auto flex gap-1.5">
                <button type="button" onClick={addOrUpdateLine} className="btn-primary-sm">
                  {editingIndex === null ? "+ Add" : "Update"}
                </button>
                {editingIndex !== null ? (
                  <button type="button" onClick={cancelEdit} className="btn-outline">
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Sale Lines */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sale Lines ({lines.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1260px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Item", "Sale Qty", "Unit Price", "Security", "Empty Return Item", "Return Qty", "Amount", ""].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${[1, 2, 3, 5, 6].includes(i) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                      No lines added yet. Fill the entry line above and click Add.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const current = lineTotals(line);
                    const item = itemById.get(line.itemId);
                    const returnItem = itemById.get(line.emptyReturnItemId);
                    return (
                      <tr key={index} className={`transition-colors ${editingIndex === index ? "bg-blue-50/60" : "hover:bg-blue-50/30"}`}>
                        <td className="px-2.5 py-2">{item ? optionLabel(item) : line.itemId}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{line.quantity}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{money(amount(line.unitPrice))}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{money(amount(line.securityDepositAmount))}</td>
                        <td className="px-2.5 py-2">{returnItem ? optionLabel(returnItem) : (item ? optionLabel(item) : "—")}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{line.emptyReturnQuantity}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums font-medium text-slate-800">{money(current.amount)}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <button type="button" onClick={() => editLine(index)} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Edit</button>
                          <button type="button" onClick={() => removeLine(index)} className="ml-1 rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Delete</button>
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
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sale Total</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.amount)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Security Total</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.securityAmount)}</div>
            </div>
            <div className="rounded-lg bg-blue-700 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Total Bill (Receivable)</div>
              <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(totals.receivableAmount)}</div>
            </div>
          </div>
        </section>

        <SettlementPanel
          totalBill={totals.receivableAmount}
          fields={settlement}
          onChange={(patch) => setSettlement((current) => ({ ...current, ...patch }))}
          banks={banks}
          showGasReturn
          gasReturn={gasReturn}
          onGasReturnChange={(patch) => setGasReturn((current) => ({ ...current, ...patch }))}
        />

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading} disabled={lines.length === 0}>Post Sale</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
