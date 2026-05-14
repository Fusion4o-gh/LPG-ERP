"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;
type ItemSlot = { itemId: string; quantity: string; unitPrice: string };
type Row = {
  customerId: string;
  elevenPointEightKgPrice: string;
  paymentType: "Cash" | "Credit";
  amountReceived: string;
  items: [ItemSlot, ItemSlot, ItemSlot];
};

const emptySlot: ItemSlot = { itemId: "", quantity: "", unitPrice: "" };
const emptyRow: Row = {
  customerId: "",
  elevenPointEightKgPrice: "",
  paymentType: "Credit",
  amountReceived: "0",
  items: [{ ...emptySlot }, { ...emptySlot }, { ...emptySlot }],
};

function label(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

function amount(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function slotTotal(slot: ItemSlot) {
  return amount(slot.quantity) * amount(slot.unitPrice);
}

function rowTotal(row: Row) {
  return row.items.reduce((sum, slot) => sum + slotTotal(slot), 0);
}

function money(value: number) {
  return value.toFixed(2);
}

export function BatchSaleForm() {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow, items: [{ ...emptySlot }, { ...emptySlot }, { ...emptySlot }] }]);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([apiGet<{ customers: Lookup[] }>("/api/customers"), apiGet<{ items: Lookup[] }>("/api/items")])
      .then(([customerData, itemData]) => {
        setCustomers(customerData.customers);
        setItems(itemData.items);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLookupLoading(false));
  }, []);

  const batchTotal = useMemo(() => rows.reduce((sum, row) => sum + rowTotal(row), 0), [rows]);

  function newRow(): Row {
    return { ...emptyRow, items: [{ ...emptySlot }, { ...emptySlot }, { ...emptySlot }] };
  }

  function updateRow(index: number, patch: Partial<Omit<Row, "items">>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function updateSlot(rowIndex: number, slotIndex: number, patch: Partial<ItemSlot>) {
    setRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;
        const slots = row.items.map((slot, currentSlotIndex) => (currentSlotIndex === slotIndex ? { ...slot, ...patch } : slot)) as Row["items"];
        return { ...row, items: slots };
      }),
    );
  }

  function removeRow(index: number) {
    setRows((current) => (current.length === 1 ? current : current.filter((_, rowIndex) => rowIndex !== index)));
  }

  function payload() {
    if (!transactionDate) throw new Error("Date is required.");
    const preparedRows = rows.map((row, rowIndex) => {
      if (!row.customerId) throw new Error(`Row ${rowIndex + 1}: customer is required.`);
      const preparedItems = row.items
        .filter((slot) => slot.itemId || slot.quantity || slot.unitPrice)
        .map((slot, slotIndex) => {
          const quantity = amount(slot.quantity);
          const unitPrice = amount(slot.unitPrice);
          if (!slot.itemId) throw new Error(`Row ${rowIndex + 1}, item ${slotIndex + 1}: item is required.`);
          if (!Number.isInteger(quantity) || quantity <= 0) throw new Error(`Row ${rowIndex + 1}, item ${slotIndex + 1}: quantity must be a positive integer.`);
          if (unitPrice <= 0) throw new Error(`Row ${rowIndex + 1}, item ${slotIndex + 1}: unit price must be positive.`);
          return { itemId: slot.itemId, quantity, unitPrice };
        });
      if (preparedItems.length === 0) throw new Error(`Row ${rowIndex + 1}: at least one item is required.`);
      return {
        customerId: row.customerId,
        elevenPointEightKgPrice: row.elevenPointEightKgPrice ? Number(row.elevenPointEightKgPrice) : undefined,
        paymentType: row.paymentType,
        amountReceived: Number(row.amountReceived || 0),
        items: preparedItems,
      };
    });
    return { transactionDate, remarks, rows: preparedRows };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await apiPost<{ batchNo: string; issueNos: string[] }>("/api/sales/lpg/batch", payload());
      setSuccess(`Saved ${result.batchNo}. Issues: ${result.issueNos.join(", ")}.`);
      setRows([newRow()]);
      setTransactionDate("");
      setRemarks("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Complete Day Sale" description="Post legacy-style daily LPG sales in one batch. Each customer row creates its own sale issue, stock ledger, receivable voucher, cylinder balance update, and optional cash receipt." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        {/* Batch Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Batch Header</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="form-label" htmlFor="transactionDate">Date *</label>
                <input id="transactionDate" type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="form-input" />
              </div>
              <div className="md:col-span-2">
                <label className="form-label" htmlFor="remarks">Remarks</label>
                <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input" />
              </div>
            </div>
          </div>
        </section>

        {/* Batch Rows */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Batch Rows</h2>
            </div>
            <button type="button" onClick={() => setRows((c) => [...c, newRow()])} className="btn-primary-sm">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">11.8 KG Price</th>
                  {[1, 2, 3].map((slot) => (
                    <th key={slot} className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Item {slot}</th>
                  ))}
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Payment</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Received</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-2.5 py-2 align-top">
                      <select value={row.customerId} onChange={(e) => updateRow(rowIndex, { customerId: e.target.value })} disabled={lookupLoading} className="tbl-select w-52">
                        <option value="">Select Customer</option>
                        {customers.map((c) => <option key={String(c.id)} value={String(c.id)}>{label(c)}</option>)}
                      </select>
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <input type="number" min="0" value={row.elevenPointEightKgPrice} onChange={(e) => updateRow(rowIndex, { elevenPointEightKgPrice: e.target.value })} className="tbl-input w-24 text-right" />
                    </td>
                    {row.items.map((slot, slotIndex) => (
                      <td key={slotIndex} className="px-2.5 py-2 align-top">
                        <div className="space-y-1.5">
                          <select value={slot.itemId} onChange={(e) => updateSlot(rowIndex, slotIndex, { itemId: e.target.value })} disabled={lookupLoading} className="tbl-select w-48">
                            <option value="">Select Item</option>
                            {items.map((item) => <option key={String(item.id)} value={String(item.id)}>{label(item)}</option>)}
                          </select>
                          <div className="flex gap-1.5">
                            <input type="number" min="1" placeholder="Qty" value={slot.quantity} onChange={(e) => updateSlot(rowIndex, slotIndex, { quantity: e.target.value })} className="tbl-input w-16 text-right" />
                            <input type="number" min="0" placeholder="Rate" value={slot.unitPrice} onChange={(e) => updateSlot(rowIndex, slotIndex, { unitPrice: e.target.value })} className="tbl-input w-20 text-right" />
                          </div>
                        </div>
                      </td>
                    ))}
                    <td className="px-2.5 py-2 text-right align-top tabular-nums font-semibold text-slate-800">{money(rowTotal(row))}</td>
                    <td className="px-2.5 py-2 align-top">
                      <select value={row.paymentType} onChange={(e) => updateRow(rowIndex, { paymentType: e.target.value as Row["paymentType"] })} className="tbl-select w-24">
                        <option value="Cash">Cash</option>
                        <option value="Credit">Credit</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <input type="number" min="0" value={row.amountReceived} onChange={(e) => updateRow(rowIndex, { amountReceived: e.target.value })} className="tbl-input w-24 text-right" />
                    </td>
                    <td className="px-2.5 py-2 align-top">
                      <button type="button" onClick={() => removeRow(rowIndex)} disabled={rows.length === 1} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rows</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{rows.length}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amount Received</div>
              <div className="mt-1.5 text-lg font-bold text-slate-800 tabular-nums">{money(rows.reduce((sum, row) => sum + amount(row.amountReceived), 0))}</div>
            </div>
            <div className="rounded-lg bg-blue-700 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Batch Total</div>
              <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(batchTotal)}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Complete Day Sale</SubmitButton>
          <button type="button" onClick={() => { setRows([newRow()]); setTransactionDate(""); setRemarks(""); setError(""); setSuccess(""); }} className="btn-outline">Reset Form</button>
        </div>
      </form>
    </>
  );
}
