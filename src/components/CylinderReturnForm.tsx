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
type ReturnLine = {
  itemId: string;
  returnType: "Empty" | "Filled";
  quantity: string;
  unitPrice: string;
};

const emptyLine: ReturnLine = { itemId: "", returnType: "Empty", quantity: "1", unitPrice: "" };

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function amount(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineTotal(line: ReturnLine) {
  if (line.returnType !== "Filled") return 0;
  return amount(line.quantity) * amount(line.unitPrice);
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
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [settlement, setSettlement] = useState(emptySettlement());

  useEffect(() => {
    Promise.all([
      apiGet<{ customers: Lookup[] }>("/api/customers"),
      apiGet<{ items: Lookup[] }>("/api/items"),
      apiGet<{ banks: { id: string; name: string }[] }>("/api/banks"),
    ])
      .then(([customerData, itemData, bankData]) => {
        setCustomers(customerData.customers);
        setItems(itemData.items);
        setBanks(bankData.banks);
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
    setSettlement(emptySettlement());
  }

  function payload() {
    if (!customerId) throw new Error("Customer is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = amount(line.quantity);
      const unitPrice = amount(line.unitPrice);
      if (!line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: return quantity must be a positive integer.`);
      if (line.returnType === "Filled" && unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price is required for filled return.`);
      return { itemId: line.itemId, returnType: line.returnType, quantity, unitPrice: line.returnType === "Filled" ? unitPrice : undefined };
    });
    return {
      customerId,
      transactionDate,
      remarks,
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
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">Return number: <span className="font-semibold text-slate-900">{printDocumentNo}</span></span>
            <Link href={`/operations/cylinder-return/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
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
                <label className="form-label" htmlFor="customerId">Customer *</label>
                <select id="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={lookupLoading} className="form-input">
                  <option value="">Select Customer</option>
                  {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{optionLabel(c)}</option>)}
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
            <button type="button" onClick={() => setLines((c) => [...c, { ...emptyLine }])} className="btn-primary-sm">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Item", "Return Type", "Return Qty", "Unit Price", "Total", ""].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${[2, 3, 4].includes(i) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => (
                  <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-2.5 py-2">
                      <select value={line.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value })} disabled={lookupLoading} className="tbl-select w-52">
                        <option value="">Select Item</option>
                        {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <select value={line.returnType} onChange={(e) => updateLine(index, { returnType: e.target.value as ReturnLine["returnType"] })} className="tbl-select w-24">
                        <option value="Empty">Empty</option>
                        <option value="Filled">Filled</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-2"><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="tbl-input w-20 text-right" /></td>
                    <td className="px-2.5 py-2"><input type="number" min="0" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} disabled={line.returnType === "Empty"} className="tbl-input w-24 text-right" /></td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-medium text-slate-800">{money(lineTotal(line))}</td>
                    <td className="px-2.5 py-2">
                      <button type="button" onClick={() => removeLine(index)} disabled={lines.length === 1} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <div className="inline-block rounded-lg bg-blue-700 p-3 min-w-[160px]">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Filled Return Total</div>
              <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(total)}</div>
            </div>
          </div>
        </section>

        {total > 0 ? (
          <SettlementPanel
            variant="payment"
            title="Refund & Settlement"
            totalBill={total}
            fields={settlement}
            onChange={(patch) => setSettlement((current) => ({ ...current, ...patch }))}
            banks={banks}
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Return</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
