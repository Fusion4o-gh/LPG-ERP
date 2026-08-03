"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { emptySettlement } from "@/lib/settlement";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SettlementPanel } from "./SettlementPanel";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Lookup = Record<string, unknown>;

function optionLabel(row: Lookup) {
  return [row.code, row.name].filter(Boolean).join(" - ");
}

export function SecurityReceiptForm() {
  const [customers, setCustomers] = useState<Lookup[]>([]);
  const [items, setItems] = useState<Lookup[]>([]);
  const [banks, setBanks] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [availableStock, setAvailableStock] = useState(0);
  const [stockLoading, setStockLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [settlement, setSettlement] = useState(emptySettlement());
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printDocumentNo, setPrintDocumentNo] = useState("");

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

  useEffect(() => {
    let active = true;
    if (!itemId) {
      setAvailableStock(0);
      setStockLoading(false);
      return () => {
        active = false;
      };
    }
    setStockLoading(true);
    apiGet<{ available: number }>(`/api/stock-availability?itemId=${encodeURIComponent(itemId)}`)
      .then((result) => {
        if (active) setAvailableStock(Number(result.available) || 0);
      })
      .catch(() => {
        if (active) setAvailableStock(0);
      })
      .finally(() => {
        if (active) setStockLoading(false);
      });
    return () => {
      active = false;
    };
  }, [itemId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setPrintDocumentNo("");
    try {
      if (!customerId || !itemId || !transactionDate) throw new Error("Customer, item, and date are required.");
      const securityAmount = Number(amount);
      if (!Number.isFinite(securityAmount) || securityAmount <= 0) throw new Error("Amount must be positive.");
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error("Quantity must be a positive integer.");

      const result = await apiPost<Record<string, unknown>>("/api/payments/security-receipt", {
        customerId,
        itemId,
        quantity: qty,
        amount: securityAmount,
        transactionDate,
        receiveMode: settlement.receiveMode,
        bankId: settlement.bankId || undefined,
        chequeNo: settlement.chequeNo || undefined,
        chequeDate: settlement.chequeDate || undefined,
        remarks: remarks.trim() || undefined,
      });
      const receiptNo = String(result.receiptNo ?? "saved");
      setSuccess(`Saved ${receiptNo}.`);
      if (result.ids && receiptNo !== "saved") setPrintDocumentNo(receiptNo);
      setCustomerId("");
      setItemId("");
      setAvailableStock(0);
      setQuantity("1");
      setAmount("");
      setRemarks("");
      setTransactionDate("");
      setSettlement(emptySettlement());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Security Receipt" description="Receive cylinder security deposit with quantity, cash/bank receipt, and cheque details." />
      <form onSubmit={onSubmit} className="space-y-5">
        <ApiError message={error} />
        <SuccessMessage message={success} />

        {printDocumentNo ? (
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="text-slate-600">
              Receipt: <span className="font-semibold text-slate-900">{printDocumentNo}</span>
            </span>
            <Link href={`/payments/security-receipt/print/${encodeURIComponent(printDocumentNo)}`} className="ml-auto btn-outline text-xs">
              Open Print View
            </Link>
          </div>
        ) : null}

        <section className="card rounded-xl p-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="form-label">Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} disabled={lookupLoading} className="form-input">
              <option value="">Select Customer</option>
              {customers.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {optionLabel(c)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Item (cylinder) *</label>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={lookupLoading} className="form-input">
              <option value="">Select Item</option>
              {items.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {optionLabel(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Quantity (cylinders) *</label>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Stock Issued</label>
            <input type="number" value={stockLoading ? "" : availableStock} readOnly aria-readonly="true" placeholder={stockLoading ? "Loading…" : "0"} className="form-input bg-slate-50" />
            <p className="mt-1 text-xs text-slate-500">Available filled cylinders for the selected item.</p>
          </div>
          <div>
            <label className="form-label">Security Amount *</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">Date *</label>
            <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="form-input" />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="form-input min-h-20" placeholder="Optional remarks" />
          </div>
        </section>

        <SettlementPanel
          totalBill={Number(amount) || 0}
          fields={{ ...settlement, discount: "0" }}
          onChange={(patch) => setSettlement((current) => ({ ...current, ...patch, discount: "0" }))}
          banks={banks}
        />

        <div className="flex flex-wrap gap-2">
          <SubmitButton loading={loading}>Post Security Receipt</SubmitButton>
        </div>
      </form>
    </>
  );
}
