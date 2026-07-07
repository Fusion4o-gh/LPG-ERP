"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { emptySettlement } from "@/lib/settlement";
import { useCompanyFormSettings, usePostSaveNavigation } from "@/lib/use-company-form-settings";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SettlementPanel } from "./SettlementPanel";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type EmptySaleLine = {
  itemId: string;
  quantity: string;
  unitPrice: string;
};

const blankLine: EmptySaleLine = { itemId: "", quantity: "1", unitPrice: "" };

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function numberValue(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function lineTotals(line: EmptySaleLine) {
  const amount = numberValue(line.quantity) * numberValue(line.unitPrice);
  return { amount };
}

function money(value: number) {
  return value.toFixed(2);
}

export function EmptySaleForm() {
  const { showDefaultDate, redirectOnSamePage, defaultTransactionDate, loaded: companySettingsLoaded } = useCompanyFormSettings();
  const { afterSave } = usePostSaveNavigation(redirectOnSamePage, "/sale-purchase/empty-sale");
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [invoiceLanguage, setInvoiceLanguage] = useState("English");
  const [lines, setLines] = useState<EmptySaleLine[]>([{ ...blankLine }]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");
  const [previewIssueNo, setPreviewIssueNo] = useState("");
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [settlement, setSettlement] = useState(emptySettlement());

  useEffect(() => {
    Promise.all([
      apiGet<{ customers: Lookup[] }>("/api/customers"),
      apiGet<{ items: Lookup[] }>("/api/items"),
      apiGet<{ banks: { id: string; name: string }[] }>("/api/banks"),
      apiGet<{ documentNo: string }>("/api/documents/next-number?kind=empty-sale"),
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
    if (companySettingsLoaded && showDefaultDate && !transactionDate) {
      setTransactionDate(defaultTransactionDate);
    }
  }, [companySettingsLoaded, showDefaultDate, defaultTransactionDate, transactionDate]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (sum, line) => {
          const current = lineTotals(line);
          return { amount: sum.amount + current.amount };
        },
        { amount: 0 },
      ),
    [lines],
  );

  function updateLine(index: number, patch: Partial<EmptySaleLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((current) => (current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index)));
  }

  function reset() {
    setCustomerId("");
    setTransactionDate(showDefaultDate ? defaultTransactionDate : "");
    setRemarks("");
    setInvoiceLanguage("English");
    setLines([{ ...blankLine }]);
    setPrintDocumentNo("");
    setSettlement(emptySettlement());
  }

  function payload() {
    if (!customerId) throw new Error("Customer is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = numberValue(line.quantity);
      const unitPrice = numberValue(line.unitPrice);
      if (!line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: quantity must be a positive integer.`);
      if (unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price must be positive.`);
      return { itemId: line.itemId, quantity, unitPrice };
    });
    return {
      customerId,
      transactionDate,
      remarks,
      invoiceLanguage,
      lines: preparedLines,
      discount: numberValue(settlement.discount),
      amountReceived: numberValue(settlement.amountReceived),
      receiveMode: settlement.receiveMode,
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
      const result = await apiPost<Record<string, unknown>>("/api/sale-purchase/empty-sale", payload());
      const issueNo = String(result.issueNo ?? "saved");
      setSuccess(`Saved ${issueNo}.`);
      if (result.ids && issueNo !== "saved") setPrintDocumentNo(issueNo);
      afterSave(reset);
      apiGet<{ documentNo: string }>("/api/documents/next-number?kind=empty-sale")
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
        title="Empty Sale"
        description="Sell empty cylinders with one issue number, empty stock OUT, customer receivable voucher, GST payable, audit trail, and printable invoice."
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
            <Link href={`/sale-purchase/empty-sale/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        {/* Sale Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Sale Header</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 lg:grid-cols-5">
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
                <label className="form-label" htmlFor="invoiceLanguage">Invoice Language</label>
                <select id="invoiceLanguage" value={invoiceLanguage} onChange={(e) => setInvoiceLanguage(e.target.value)} className="form-input">
                  <option value="English">English</option>
                  <option value="Urdu">Urdu</option>
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="remarks">Remarks</label>
                <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
              </div>
            </div>
          </div>
        </section>

        {/* Sale Lines */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Empty Sale Lines</h2>
            </div>
            <button type="button" onClick={() => setLines((c) => [...c, { ...blankLine }])} className="btn-primary-sm">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Item", "Quantity", "Unit Price", "Amount", ""].map((h, i) => (
                    <th key={i} className={`whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${[1, 2, 3].includes(i) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => {
                  const current = lineTotals(line);
                  return (
                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-2.5 py-2">
                        <select value={line.itemId} onChange={(e) => updateLine(index, { itemId: e.target.value })} disabled={lookupLoading} className="tbl-select w-52">
                          <option value="">Select Item</option>
                          {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{optionLabel(item)}</option>)}
                        </select>
                      </td>
                      <td className="px-2.5 py-2"><input type="number" min="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} className="tbl-input w-20 text-right" /></td>
                      <td className="px-2.5 py-2"><input type="number" min="0" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} className="tbl-input w-24 text-right" /></td>
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
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
            <div className="inline-block rounded-lg bg-blue-700 p-3 min-w-[160px]">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Sale Total</div>
              <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(totals.amount)}</div>
            </div>
          </div>
        </section>

        <SettlementPanel
          totalBill={totals.amount}
          fields={settlement}
          onChange={(patch) => setSettlement((current) => ({ ...current, ...patch }))}
          banks={banks}
        />

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Empty Sale</SubmitButton>
          <button type="button" onClick={reset} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
