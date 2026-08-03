"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SuccessMessage } from "./SuccessMessage";
import { todayDateInputValue } from "@/lib/use-company-form-settings";

type Customer = { id: string; code: string; name: string };
type Price = {
  id: string;
  customerId: string | null;
  customerName: string;
  price: string;
  pricePerKg: string;
  validFrom: string;
  validTo: string;
};

const today = todayDateInputValue;

export function ItemPriceManager({ itemId }: { itemId: string }) {
  const [item, setItem] = useState<{ code: string; name: string; cylinderWeightKg: string | null } | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [price, setPrice] = useState("");
  const [pricePerKg, setPricePerKg] = useState("");
  const [validFrom, setValidFrom] = useState(today());
  const [validTo, setValidTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    const [priceData, customerData] = await Promise.all([
      apiGet<{ item: { code: string; name: string; cylinderWeightKg: string | null }; prices: Price[] }>(`/api/items/${encodeURIComponent(itemId)}/price`),
      apiGet<{ customers: Customer[] }>("/api/customers"),
    ]);
    setItem(priceData.item);
    setPrices(priceData.prices);
    setCustomers(customerData.customers);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((err: Error) => {
      setError(err.message);
      setLoading(false);
    });
  }, [itemId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!price && !pricePerKg) {
      setError("Set a price or price per kg.");
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/api/items/${encodeURIComponent(itemId)}/price`, {
        customerId: customerId || undefined,
        price: price || undefined,
        pricePerKg: pricePerKg || undefined,
        validFrom,
        validTo: validTo || undefined,
      });
      setSuccess("Price definition saved.");
      setPrice("");
      setPricePerKg("");
      setValidFrom(today());
      setValidTo("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Price save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Define Prices"
        description={item ? `${item.code} - ${item.name}${item.cylinderWeightKg ? ` · ${item.cylinderWeightKg} KG` : ""}` : "Item pricing history"}
      />
      <div className="mb-4">
        <Link href="/masters/items" className="btn-outline">Back to Items</Link>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_1fr]">
        <form onSubmit={onSubmit} className="card rounded-xl p-5 space-y-3">
          <ApiError message={error} />
          <SuccessMessage message={success} />
          <label className="block">
            <span className="form-label">Customer</span>
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="form-select">
              <option value="">Default price</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} - {customer.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="form-label">Sale Price</span>
            <input type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} className="form-input" />
          </label>
          <label className="block">
            <span className="form-label">Price Per KG {item?.cylinderWeightKg ? "(optional)" : "(requires item weight)"}</span>
            <input type="number" min="0.0001" step="0.0001" value={pricePerKg} onChange={(event) => setPricePerKg(event.target.value)} disabled={!item?.cylinderWeightKg} className="form-input" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="form-label">Valid From</span><input type="date" required value={validFrom} onChange={(event) => setValidFrom(event.target.value)} className="form-input" /></label>
            <label className="block"><span className="form-label">Valid To</span><input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} className="form-input" /></label>
          </div>
          <button type="submit" disabled={saving || loading} className="btn-primary">{saving ? "Saving..." : "Save Price"}</button>
        </form>
        <section className="card rounded-xl p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Price History</h2>
          {loading ? <p className="text-sm text-slate-500">Loading...</p> : prices.length === 0 ? <p className="text-sm text-slate-500">No price definitions yet.</p> : (
            <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="px-2 py-2">Customer</th><th className="px-2 py-2">Sale Price</th><th className="px-2 py-2">Per KG</th><th className="px-2 py-2">Valid From</th><th className="px-2 py-2">Valid To</th></tr></thead><tbody>{prices.map((entry) => <tr key={entry.id} className="border-b border-slate-100"><td className="px-2 py-2">{entry.customerName}</td><td className="px-2 py-2">{entry.price}</td><td className="px-2 py-2">{entry.pricePerKg || "—"}</td><td className="px-2 py-2">{entry.validFrom}</td><td className="px-2 py-2">{entry.validTo || "Open"}</td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </>
  );
}
