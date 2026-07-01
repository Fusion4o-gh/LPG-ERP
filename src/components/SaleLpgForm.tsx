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

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function amount(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineTotals(line: SaleLine) {
  const amount = Number(line.quantity) * Number(line.unitPrice || 0);
  return { amount, securityAmount: Number(line.securityDepositAmount || 0), receivableAmount: amount + Number(line.securityDepositAmount || 0) };
}

function money(value: number) {
  return value.toFixed(2);
}

export function SaleLpgForm() {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [saleType, setSaleType] = useState("Direct");
  const [remarks, setRemarks] = useState("");
  const [elevenPointEightKgPrice, setElevenPointEightKgPrice] = useState("");
  const [invoiceLanguage, setInvoiceLanguage] = useState("English");
  const [lines, setLines] = useState<SaleLine[]>([{ ...emptyLine }]);
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

  useEffect(() => {
    if (!customerId && lines.every((line) => !line.itemId)) {
      setCustomerBalance(null);
      setFilledStock({});
      return;
    }
    const params = new URLSearchParams();
    if (customerId) params.set("customerId", customerId);
    for (const line of lines) {
      if (line.itemId) params.append("itemId", line.itemId);
    }
    apiGet<{
      customerBalance: { receivableBalance: number; emptyOwed: number; filledOutstanding: number } | null;
      filledStock: Record<string, number>;
      kgPricing: Record<string, { unitPrice: string; pricePerKg: string | null; cylinderWeightKg: string | null; usingKgPricing: boolean } | null>;
    }>(`/api/sales/lpg/context?${params.toString()}`)
      .then((data) => {
        setCustomerBalance(data.customerBalance);
        setFilledStock(data.filledStock);
        setKgPricing(data.kgPricing ?? {});
      })
      .catch(() => {
        setCustomerBalance(null);
        setFilledStock({});
        setKgPricing({});
      });
  }, [customerId, lines]);

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

  function updateLine(index: number, patch: Partial<SaleLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  function reset() {
    setCustomerId("");
    setTransactionDate("");
    setSaleType("Direct");
    setRemarks("");
    setElevenPointEightKgPrice("");
    setInvoiceLanguage("English");
    setLines([{ ...emptyLine }]);
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
    const preparedLines = lines.map((line, index) => {
      const quantity = amount(line.quantity);
      const unitPrice = amount(line.unitPrice);
      const securityDepositAmount = amount(line.securityDepositAmount);
      const emptyReturnQuantity = amount(line.emptyReturnQuantity);
      if (!line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: sale quantity must be a positive integer.`);
      if (unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price must be positive.`);
      if (securityDepositAmount < 0) throw new Error(`Line ${index + 1}: security amount cannot be negative.`);
      if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`Line ${index + 1}: return quantity must be a non-negative integer.`);
      return {
        itemId: line.itemId,
        quantity,
        unitPrice,
        securityDepositAmount,
        emptyReturnItemId: line.emptyReturnItemId || line.itemId,
        emptyReturnQuantity,
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
      setCustomerId("");
      setTransactionDate("");
      setSaleType("Direct");
      setRemarks("");
      setElevenPointEightKgPrice("");
      setInvoiceLanguage("English");
      setLines([{ ...emptyLine }]);
      setSettlement(emptySettlement());
      setGasReturn({ returnGasKg: "", rate: "" });
      apiGet<{ documentNo: string }>("/api/documents/next-number?kind=sale-issue")
        .then((preview) => setPreviewIssueNo(preview.documentNo))
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
        title="Sale LPG"
        description="Create a legacy-style multi-line LPG invoice with settlement, live customer balance, and stock preview."
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
            <div className="grid gap-4 lg:grid-cols-6">
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

        {/* Sale Lines */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sale Lines</h2>
            </div>
            <button type="button" onClick={() => setLines((c) => [...c, { ...emptyLine }])} className="btn-primary-sm">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1260px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Item", "Sale Qty", "Unit Price", "Security", "Empty Return Item", "Return Qty", "Filled Stock", "Amount", ""].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${[1, 2, 3, 5, 7].includes(i) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => {
                  const current = lineTotals(line);
                  return (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-2.5 py-2">
                        <select value={line.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value, emptyReturnItemId: line.emptyReturnItemId || e.target.value })} disabled={lookupLoading} className="tbl-select w-52">
                          <option value="">Select Item</option>
                          {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                        </select>
                      </td>
                      <td className="px-2.5 py-2"><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="tbl-input w-20 text-right" /></td>
                      <td className="px-2.5 py-2">
                        <input type="number" min="0" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} className="tbl-input w-24 text-right" />
                        {line.itemId && kgPricing[line.itemId] ? (
                          <KgPriceField
                            pricePerKg={kgPricing[line.itemId]?.pricePerKg ? Number(kgPricing[line.itemId]!.pricePerKg) : null}
                            cylinderWeightKg={kgPricing[line.itemId]?.cylinderWeightKg ? Number(kgPricing[line.itemId]!.cylinderWeightKg) : null}
                            quantity={amount(line.quantity)}
                            unitPrice={amount(line.unitPrice)}
                            onUnitPriceChange={(price) => updateLine(index, { unitPrice: String(price) })}
                          />
                        ) : null}
                      </td>
                      <td className="px-2.5 py-2"><input type="number" min="0" value={line.securityDepositAmount} onChange={(e) => updateLine(index, { securityDepositAmount: e.target.value })} className="tbl-input w-20 text-right" /></td>
                      <td className="px-2.5 py-2">
                        <select value={line.emptyReturnItemId} onChange={(e) => updateLine(index, { emptyReturnItemId: e.target.value })} disabled={lookupLoading} className="tbl-select w-52">
                          <option value="">Same as sale item</option>
                          {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                        </select>
                      </td>
                      <td className="px-2.5 py-2"><input type="number" min="0" value={line.emptyReturnQuantity} onChange={(e) => updateLine(index, { emptyReturnQuantity: e.target.value })} className="tbl-input w-20 text-right" /></td>
                      <td className="px-2.5 py-2 text-right text-xs font-medium tabular-nums text-slate-600">
                        {line.itemId ? filledStock[line.itemId] ?? 0 : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right tabular-nums font-medium text-slate-800">{money(current.amount)}</td>
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
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sale Total</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.amount)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Security Total</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(totals.securityAmount)}</div>
            </div>
            <div className="rounded-lg bg-blue-700 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Receivable Total</div>
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
          <SubmitButton loading={loading}>Post Sale</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
