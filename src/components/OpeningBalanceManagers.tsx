"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { DataTable } from "./DataTable";
import { FormSection } from "./FormSection";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function dateValue(value: unknown) {
  return String(value ?? "").slice(0, 10);
}

export function ShopOpeningBalanceManager() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [values, setValues] = useState({ itemId: "", cylinderState: "FILLED", quantity: "", transactionDate: today() });
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [openingData, itemData] = await Promise.all([
        apiGet<{ entries: Record<string, unknown>[] }>("/api/configuration/shop-opening-balance"),
        apiGet<{ items: Record<string, unknown>[] }>("/api/items"),
      ]);
      setRows(openingData.entries);
      setItems(itemData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function reset() {
    setValues({ itemId: "", cylinderState: "FILLED", quantity: "", transactionDate: today() });
    setEditingId("");
  }

  function edit(row: Record<string, unknown>) {
    setEditingId(String(row.id));
    setValues({
      itemId: String(row.itemId ?? ""),
      cylinderState: String(row.cylinderState ?? "FILLED"),
      quantity: String(row.quantity ?? ""),
      transactionDate: dateValue(row.transactionDate),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!values.itemId) return setError("Item is required.");
    if (!Number.isInteger(Number(values.quantity)) || Number(values.quantity) <= 0) return setError("Quantity must be a positive integer.");

    setSaving(true);
    try {
      const payload = { ...values, quantity: Number(values.quantity) };
      if (editingId) await apiPut(`/api/configuration/shop-opening-balance/${editingId}`, payload);
      else await apiPost("/api/configuration/shop-opening-balance", payload);
      setSuccess(editingId ? "Shop Opening Balance updated." : "Shop Opening Balance created.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Record<string, unknown>) {
    if (!window.confirm("Delete this opening stock entry?")) return;
    setError("");
    setSuccess("");
    try {
      await apiDelete(`/api/configuration/shop-opening-balance/${row.id}`);
      setSuccess("Shop Opening Balance deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <>
      <PageHeader title="Shop Opening Balance" description="Enter initial filled or empty cylinder stock before item movement starts." />
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form onSubmit={submit} className="space-y-4">
          <ApiError message={error} />
          <SuccessMessage message={success} />
          <FormSection title={editingId ? "Edit Shop Opening Balance" : "Add Shop Opening Balance"}>
            <div className="space-y-3">
              <Field label="Item" required>
                <select value={values.itemId} onChange={(event) => setValues((current) => ({ ...current, itemId: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                  <option value="">Select item</option>
                  {items.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {[item.code, item.name].filter(Boolean).join(" - ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type" required>
                <select value={values.cylinderState} onChange={(event) => setValues((current) => ({ ...current, cylinderState: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                  <option value="FILLED">Filled</option>
                  <option value="EMPTY">Empty</option>
                </select>
              </Field>
              <Field label="Quantity" required>
                <input type="number" min="1" value={values.quantity} onChange={(event) => setValues((current) => ({ ...current, quantity: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Date" required>
                <input type="date" value={values.transactionDate} onChange={(event) => setValues((current) => ({ ...current, transactionDate: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
            </div>
          </FormSection>
          <div className="flex gap-2">
            <button disabled={saving} className="rounded-md bg-blue-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Reset
            </button>
          </div>
        </form>
        <DataTable
          loading={loading}
          rows={rows}
          columns={[
            { key: "transactionDate", label: "Date", render: (row) => dateValue(row.transactionDate) },
            { key: "item", label: "Item", render: (row) => `${(row.item as { code?: string; name?: string })?.code ?? ""} ${(row.item as { name?: string })?.name ?? ""}` },
            { key: "cylinderState", label: "Type" },
            { key: "quantity", label: "Quantity" },
            { key: "sourceId", label: "Source" },
            { key: "locked", label: "Locked", render: (row) => (row.locked ? <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900">Locked</span> : "Open") },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-2">
                  <button disabled={Boolean(row.locked)} onClick={() => edit(row)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
                    Edit
                  </button>
                  <button disabled={Boolean(row.locked)} onClick={() => remove(row)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-40">
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

export function CashOpeningManager() {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [values, setValues] = useState({ accountId: "", amount: "", balanceType: "DEBIT", transactionDate: today() });
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ openings: Record<string, unknown>[]; accounts: Record<string, unknown>[] }>("/api/configuration/cash-opening");
      setRows(data.openings);
      setAccounts(data.accounts);
      if (!values.accountId && data.accounts[0]?.id) setValues((current) => ({ ...current, accountId: String(data.accounts[0].id) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setValues({ accountId: accounts[0]?.id ? String(accounts[0].id) : "", amount: "", balanceType: "DEBIT", transactionDate: today() });
    setEditingId("");
  }

  function edit(row: Record<string, unknown>) {
    setEditingId(String(row.id));
    setValues({ accountId: String(row.accountId ?? ""), amount: String(row.amount ?? ""), balanceType: String(row.balanceType ?? "DEBIT"), transactionDate: dateValue(row.voucherDate) });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!values.accountId) return setError("Account is required.");
    if (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) return setError("Amount must be a positive number.");

    setSaving(true);
    try {
      const payload = { ...values, amount: Number(values.amount) };
      if (editingId) await apiPut(`/api/configuration/cash-opening/${editingId}`, payload);
      else await apiPost("/api/configuration/cash-opening", payload);
      setSuccess(editingId ? "Cash Opening updated." : "Cash Opening created.");
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Record<string, unknown>) {
    if (!window.confirm("Delete this cash opening entry?")) return;
    setError("");
    setSuccess("");
    try {
      await apiDelete(`/api/configuration/cash-opening/${row.id}`);
      setSuccess("Cash Opening deleted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <>
      <PageHeader title="Cash Opening" description="Enter opening cash balance before cash account movement starts." />
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <form onSubmit={submit} className="space-y-4">
          <ApiError message={error} />
          <SuccessMessage message={success} />
          <FormSection title={editingId ? "Edit Cash Opening" : "Add Cash Opening"}>
            <div className="space-y-3">
              <Field label="Account" required>
                <select value={values.accountId} onChange={(event) => setValues((current) => ({ ...current, accountId: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                  <option value="">Select cash account</option>
                  {accounts.map((account) => (
                    <option key={String(account.id)} value={String(account.id)}>
                      {[account.code, account.name].filter(Boolean).join(" - ")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount" required>
                <input type="number" min="0.01" step="0.01" value={values.amount} onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
              <Field label="Debit / Credit Type" required>
                <select value={values.balanceType} onChange={(event) => setValues((current) => ({ ...current, balanceType: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </Field>
              <Field label="Date" required>
                <input type="date" value={values.transactionDate} onChange={(event) => setValues((current) => ({ ...current, transactionDate: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2" />
              </Field>
            </div>
          </FormSection>
          <div className="flex gap-2">
            <button disabled={saving} className="rounded-md bg-blue-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Reset
            </button>
          </div>
        </form>
        <DataTable
          loading={loading}
          rows={rows}
          columns={[
            { key: "voucherDate", label: "Date", render: (row) => dateValue(row.voucherDate) },
            { key: "account", label: "Account", render: (row) => `${(row.account as { code?: string; name?: string })?.code ?? ""} ${(row.account as { name?: string })?.name ?? ""}` },
            { key: "amount", label: "Amount" },
            { key: "balanceType", label: "Debit/Credit" },
            { key: "voucherNo", label: "Voucher No" },
            { key: "locked", label: "Locked", render: (row) => (row.locked ? <span className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900">Locked</span> : "Open") },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-2">
                  <button disabled={Boolean(row.locked)} onClick={() => edit(row)} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40">
                    Edit
                  </button>
                  <button disabled={Boolean(row.locked)} onClick={() => remove(row)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 disabled:opacity-40">
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block font-medium">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
