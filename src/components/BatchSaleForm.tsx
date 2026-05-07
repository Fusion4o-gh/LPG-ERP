"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Row = { customerId: string; itemId: string; quantity: string; unitPrice: string; transactionDate: string };

const emptyRow: Row = { customerId: "", itemId: "", quantity: "1", unitPrice: "", transactionDate: "" };

function label(row: Record<string, unknown>) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

export function BatchSaleForm() {
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([apiGet<{ customers: Record<string, unknown>[] }>("/api/customers"), apiGet<{ items: Record<string, unknown>[] }>("/api/items")])
      .then(([customerData, itemData]) => {
        setCustomers(customerData.customers);
        setItems(itemData.items);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const sales = rows.map((row) => ({
        customerId: row.customerId,
        itemId: row.itemId,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
        transactionDate: row.transactionDate,
      }));
      if (sales.some((sale) => !sale.customerId || !sale.itemId || !sale.transactionDate || sale.quantity <= 0 || sale.unitPrice <= 0)) {
        throw new Error("Each sale row needs customer, item, quantity, unit price, and date.");
      }
      const result = await apiPost<{ batchNo: string }>("/api/sales/lpg/batch", { sales });
      setSuccess(`Saved ${result.batchNo}.`);
      setRows([{ ...emptyRow }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Complete Day Sale" description="Post multiple LPG sale issues in one batch. Each row still writes stock ledger, voucher, cylinder balance, and audit through the API service layer." />
      <form onSubmit={onSubmit} className="space-y-4">
        <ApiError message={error} />
        <SuccessMessage message={success} />
        <FormSection title="Sale Rows">
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-5">
                <select value={row.customerId} onChange={(event) => update(index, { customerId: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2">
                  <option value="">Customer</option>
                  {customers.map((customer) => (
                    <option key={String(customer.id)} value={String(customer.id)}>
                      {label(customer)}
                    </option>
                  ))}
                </select>
                <select value={row.itemId} onChange={(event) => update(index, { itemId: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2">
                  <option value="">Item</option>
                  {items.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {label(item)}
                    </option>
                  ))}
                </select>
                <input type="number" min="1" value={row.quantity} onChange={(event) => update(index, { quantity: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
                <input type="number" min="1" value={row.unitPrice} onChange={(event) => update(index, { unitPrice: event.target.value })} placeholder="Unit price" className="rounded-md border border-slate-300 px-3 py-2" />
                <input type="date" value={row.transactionDate} onChange={(event) => update(index, { transactionDate: event.target.value })} className="rounded-md border border-slate-300 px-3 py-2" />
              </div>
            ))}
          </div>
        </FormSection>
        <div className="flex gap-2">
          <button type="button" onClick={() => setRows((current) => [...current, { ...emptyRow }])} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Add Row
          </button>
          <SubmitButton loading={loading}>Post Complete Day Sale</SubmitButton>
        </div>
      </form>
    </>
  );
}
