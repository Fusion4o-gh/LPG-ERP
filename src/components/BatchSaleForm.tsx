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

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Batch Header</div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm text-slate-700">
              <span className="mb-1 block font-medium">Date *</span>
              <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
            <label className="block text-sm text-slate-700 md:col-span-2">
              <span className="mb-1 block font-medium">Remarks</span>
              <input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full rounded-md border border-blue-100 px-3 py-2" />
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">Batch Rows</div>
            <button type="button" onClick={() => setRows((current) => [...current, newRow()])} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              Add Row
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] border-collapse text-sm">
              <thead className="bg-blue-50 text-left text-blue-950">
                <tr>
                  <th className="border border-blue-100 px-2 py-2">Customer</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">11.8 KG Price</th>
                  {[1, 2, 3].map((slot) => (
                    <th key={slot} className="border border-blue-100 px-2 py-2">
                      Item {slot}
                    </th>
                  ))}
                  <th className="border border-blue-100 px-2 py-2 text-right">Total</th>
                  <th className="border border-blue-100 px-2 py-2">Payment</th>
                  <th className="border border-blue-100 px-2 py-2 text-right">Received</th>
                  <th className="border border-blue-100 px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="border border-blue-100 px-2 py-2 align-top">
                      <select value={row.customerId} onChange={(event) => updateRow(rowIndex, { customerId: event.target.value })} disabled={lookupLoading} className="w-56 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                        <option value="">Select Customer</option>
                        {customers.map((customer) => (
                          <option key={String(customer.id)} value={String(customer.id)}>
                            {label(customer)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-blue-100 px-2 py-2 align-top">
                      <input type="number" min="0" value={row.elevenPointEightKgPrice} onChange={(event) => updateRow(rowIndex, { elevenPointEightKgPrice: event.target.value })} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                    </td>
                    {row.items.map((slot, slotIndex) => (
                      <td key={slotIndex} className="border border-blue-100 px-2 py-2 align-top">
                        <div className="space-y-2">
                          <select value={slot.itemId} onChange={(event) => updateSlot(rowIndex, slotIndex, { itemId: event.target.value })} disabled={lookupLoading} className="w-52 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                            <option value="">Select Item</option>
                            {items.map((item) => (
                              <option key={String(item.id)} value={String(item.id)}>
                                {label(item)}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <input type="number" min="1" placeholder="Qty" value={slot.quantity} onChange={(event) => updateSlot(rowIndex, slotIndex, { quantity: event.target.value })} className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                            <input type="number" min="0" placeholder="Rate" value={slot.unitPrice} onChange={(event) => updateSlot(rowIndex, slotIndex, { unitPrice: event.target.value })} className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                          </div>
                        </div>
                      </td>
                    ))}
                    <td className="border border-blue-100 px-2 py-2 text-right align-top font-semibold tabular-nums">{money(rowTotal(row))}</td>
                    <td className="border border-blue-100 px-2 py-2 align-top">
                      <select value={row.paymentType} onChange={(event) => updateRow(rowIndex, { paymentType: event.target.value as Row["paymentType"] })} className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5">
                        <option value="Cash">Cash</option>
                        <option value="Credit">Credit</option>
                      </select>
                    </td>
                    <td className="border border-blue-100 px-2 py-2 align-top">
                      <input type="number" min="0" value={row.amountReceived} onChange={(event) => updateRow(rowIndex, { amountReceived: event.target.value })} className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right" />
                    </td>
                    <td className="border border-blue-100 px-2 py-2 align-top">
                      <button type="button" onClick={() => removeRow(rowIndex)} disabled={rows.length === 1} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md bg-blue-50 p-3 text-blue-950">
              <div className="text-xs font-semibold uppercase">Rows</div>
              <div className="mt-1 text-lg font-semibold">{rows.length}</div>
            </div>
            <div className="rounded-md bg-blue-50 p-3 text-blue-950">
              <div className="text-xs font-semibold uppercase">Amount Received</div>
              <div className="mt-1 text-lg font-semibold">{money(rows.reduce((sum, row) => sum + amount(row.amountReceived), 0))}</div>
            </div>
            <div className="rounded-md bg-blue-700 p-3 text-white">
              <div className="text-xs font-semibold uppercase">Batch Total</div>
              <div className="mt-1 text-lg font-semibold">{money(batchTotal)}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Complete Day Sale</SubmitButton>
          <button type="button" onClick={() => { setRows([newRow()]); setTransactionDate(""); setRemarks(""); setError(""); setSuccess(""); }} className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            Reset Form
          </button>
        </div>
      </form>
    </>
  );
}
