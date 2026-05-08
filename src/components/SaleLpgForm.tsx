"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type SaleLine = {
  itemId: string;
  quantity: string;
  unitPrice: string;
  gstPercent: string;
  securityDepositAmount: string;
  emptyReturnItemId: string;
  emptyReturnQuantity: string;
};

const emptyLine: SaleLine = {
  itemId: "",
  quantity: "1",
  unitPrice: "",
  gstPercent: "0",
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
  const exGstAmount = amount(line.quantity) * amount(line.unitPrice);
  const gstAmount = exGstAmount * (amount(line.gstPercent) / 100);
  const securityAmount = amount(line.securityDepositAmount);
  return { exGstAmount, gstAmount, securityAmount, incGstAmount: exGstAmount + gstAmount, receivableAmount: exGstAmount + gstAmount + securityAmount };
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

  useEffect(() => {
    Promise.all([apiGet<{ customers: Lookup[] }>("/api/customers"), apiGet<{ items: Lookup[] }>("/api/items")])
      .then(([customerData, itemData]) => {
        setCustomers(customerData.customers);
        setItems(itemData.items);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, []);

  const selectedCustomerBalance = useMemo(() => {
    if (!customerId) return "Select customer to view balance context.";
    const customer = customers.find((row) => String(row.id) === customerId);
    return customer ? optionLabel(customer) : "Customer selected.";
  }, [customerId, customers]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (sum, line) => {
          const current = lineTotals(line);
          return {
            exGstAmount: sum.exGstAmount + current.exGstAmount,
            gstAmount: sum.gstAmount + current.gstAmount,
            securityAmount: sum.securityAmount + current.securityAmount,
            receivableAmount: sum.receivableAmount + current.receivableAmount,
          };
        },
        { exGstAmount: 0, gstAmount: 0, securityAmount: 0, receivableAmount: 0 },
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
  }

  function payload() {
    if (!customerId) throw new Error("Customer is required.");
    if (!transactionDate) throw new Error("Date is required.");
    const preparedLines = lines.map((line, index) => {
      const quantity = amount(line.quantity);
      const unitPrice = amount(line.unitPrice);
      const gstPercent = amount(line.gstPercent);
      const securityDepositAmount = amount(line.securityDepositAmount);
      const emptyReturnQuantity = amount(line.emptyReturnQuantity);
      if (!line.itemId) throw new Error(`Line ${index + 1}: item is required.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Line ${index + 1}: sale quantity must be a positive integer.`);
      if (unitPrice <= 0) throw new Error(`Line ${index + 1}: unit price must be positive.`);
      if (gstPercent < 0) throw new Error(`Line ${index + 1}: GST % cannot be negative.`);
      if (securityDepositAmount < 0) throw new Error(`Line ${index + 1}: security amount cannot be negative.`);
      if (!Number.isInteger(emptyReturnQuantity) || emptyReturnQuantity < 0) throw new Error(`Line ${index + 1}: return quantity must be a non-negative integer.`);
      return {
        itemId: line.itemId,
        quantity,
        unitPrice,
        gstPercent,
        securityDepositAmount,
        emptyReturnItemId: line.emptyReturnItemId || line.itemId,
        emptyReturnQuantity,
      };
    });
    return {
      customerId,
      transactionDate,
      saleType,
      remarks,
      elevenPointEightKgPrice: elevenPointEightKgPrice ? Number(elevenPointEightKgPrice) : undefined,
      invoiceLanguage,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Sale LPG" description="Create a legacy-style multi-line LPG invoice with one issue number, filled stock out per line, same-sale empty returns, aggregate receivable voucher, GST, security, and cylinder accountability." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        {printDocumentNo ? (
          <div className="rounded-md border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700">
            Document number: <span className="font-semibold text-slate-950">{printDocumentNo}</span>
            <Link href={`/operations/sale-lpg/print/${encodeURIComponent(printDocumentNo)}`} className="ml-3 font-semibold text-blue-700 underline">
              Open printable view
            </Link>
          </div>
        ) : null}

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Invoice Header</div>
          <div className="grid gap-4 lg:grid-cols-6">
            <label className="block text-sm text-slate-700 lg:col-span-2">
              <span className="mb-1 block font-medium">Customer *</span>
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={lookupLoading} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={String(customer.id)} value={String(customer.id)}>
                    {optionLabel(customer)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Date *</span>
              <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Sale Type</span>
              <select value={saleType} onChange={(event) => setSaleType(event.target.value)} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                <option value="Direct">Direct</option>
              </select>
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">11.8 KG Price</span>
              <input type="number" min="0" value={elevenPointEightKgPrice} onChange={(event) => setElevenPointEightKgPrice(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Invoice Language</span>
              <select value={invoiceLanguage} onChange={(event) => setInvoiceLanguage(event.target.value)} className="w-full rounded-md border border-blue-100 bg-white px-3 py-2">
                <option value="English">English</option>
                <option value="Urdu">Urdu</option>
              </select>
            </label>
            <label className="block text-sm text-slate-700 lg:col-span-4">
              <span className="mb-1 block font-medium">Remarks</span>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-950 lg:col-span-2">
              <div className="text-xs font-semibold uppercase">Customer Balance</div>
              <div className="mt-1">{selectedCustomerBalance}</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Sale Lines</div>
            <button type="button" onClick={() => setLines((current) => [...current, { ...emptyLine }])} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1260px] border-collapse text-sm">
              <thead className="bg-blue-50 text-left text-blue-950">
                <tr>
                  <th className="border border-blue-100 px-2 py-2">Item</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Sale Qty</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Unit Price</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">GST %</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Security</th>
                  <th className="border border-blue-100 px-2 py-2">Empty Return Item</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Return Qty</th>
                  <th className="border border-blue-100 px-2 py-2">Filled Stock</th>
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
                        <select value={line.itemId} onChange={(event) => updateLine(index, { itemId: event.target.value, emptyReturnItemId: line.emptyReturnItemId || event.target.value })} disabled={lookupLoading} className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                          <option value="">Select Item</option>
                          {items.map((item) => (
                            <option key={String(item.id)} value={String(item.id)}>
                              {optionLabel(item)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="1" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.gstPercent} onChange={(event) => updateLine(index, { gstPercent: event.target.value })} className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <input type="number" min="0" value={line.securityDepositAmount} onChange={(event) => updateLine(index, { securityDepositAmount: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                      </td>
                      <td className="border border-blue-100 px-2 py-2">
                        <select value={line.emptyReturnItemId} onChange={(event) => updateLine(index, { emptyReturnItemId: event.target.value })} disabled={lookupLoading} className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                          <option value="">Same as sale item</option>
                          {items.map((item) => (
                            <option key={String(item.id)} value={String(item.id)}>
                              {optionLabel(item)}
                            </option>
                          ))}
                        </select>
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
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-md bg-blue-50 p-3 text-blue-950">
              <div className="text-xs font-semibold uppercase">Ex-GST Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.exGstAmount)}</div>
            </div>
            <div className="rounded-md bg-blue-50 p-3 text-blue-950">
              <div className="text-xs font-semibold uppercase">GST Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.gstAmount)}</div>
            </div>
            <div className="rounded-md bg-blue-50 p-3 text-blue-950">
              <div className="text-xs font-semibold uppercase">Security Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.securityAmount)}</div>
            </div>
            <div className="rounded-md bg-blue-700 p-3 text-white">
              <div className="text-xs font-semibold uppercase">Receivable Total</div>
              <div className="mt-1 text-lg font-semibold">{money(totals.receivableAmount)}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Sale</SubmitButton>
          <button type="button" onClick={reset} className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
