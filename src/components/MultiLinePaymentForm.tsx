"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
import { SubmitButton } from "./SubmitButton";
import { SuccessMessage } from "./SuccessMessage";

type Account = { id: string; code: string; name: string; accountType: string };
type Bank = { id: string; name: string };
type PaymentLine = { uid: number; accountId: string; description: string; amount: string };

export type PaymentType = "cash-receipt" | "cash-payment" | "bank-receipt" | "bank-payment";

const CONFIG: Record<PaymentType, { title: string; description: string; systemLabel: string; printBase: string; receiptKey: string }> = {
  "cash-receipt": {
    title: "Cash Receipt",
    description: "Receive cash. Cash is debited; selected accounts credited.",
    systemLabel: "Cash Account (auto-debited)",
    printBase: "/payments/cash-receipt",
    receiptKey: "receiptNo",
  },
  "cash-payment": {
    title: "Cash Payment",
    description: "Make cash payment. Selected accounts debited; cash credited.",
    systemLabel: "Cash Account (auto-credited)",
    printBase: "/payments/cash-payment",
    receiptKey: "voucherNo",
  },
  "bank-receipt": {
    title: "Bank Receipt",
    description: "Receive payment into bank. Bank debited; selected accounts credited.",
    systemLabel: "Bank Account (auto-debited)",
    printBase: "/payments/bank-receipt",
    receiptKey: "receiptNo",
  },
  "bank-payment": {
    title: "Bank Payment",
    description: "Make payment from bank. Selected accounts debited; bank credited.",
    systemLabel: "Bank Account (auto-credited)",
    printBase: "/payments/bank-payment",
    receiptKey: "voucherNo",
  },
};

const ACCOUNT_TYPES_FOR_PAYMENT: Record<PaymentType, string[]> = {
  "cash-receipt": ["ASSET", "LIABILITY", "REVENUE"],
  "cash-payment": ["ASSET", "LIABILITY", "EXPENSE"],
  "bank-receipt": ["ASSET", "LIABILITY", "REVENUE"],
  "bank-payment": ["ASSET", "LIABILITY", "EXPENSE"],
};

let lineCounter = 1;

function emptyLine(): PaymentLine {
  return { uid: lineCounter++, accountId: "", description: "", amount: "" };
}

function money(value: string) {
  return Number(value || 0).toFixed(2);
}

export function MultiLinePaymentForm({ type }: { type: PaymentType }) {
  const formId = useId();
  const config = CONFIG[type];
  const isBankType = type === "bank-receipt" || type === "bank-payment";
  const allowedTypes = ACCOUNT_TYPES_FOR_PAYMENT[type];

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loadError, setLoadError] = useState("");

  const [voucherDate, setVoucherDate] = useState("");
  const [narration, setNarration] = useState("");
  const [bankId, setBankId] = useState("");
  const [lines, setLines] = useState<PaymentLine[]>([emptyLine()]);
  const [allowOverride, setAllowOverride] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [postedNo, setPostedNo] = useState("");

  useEffect(() => {
    const fetches: Promise<void>[] = [
      apiGet<{ accounts: Account[] }>("/api/chart-of-accounts")
        .then((d) => setAccounts(d.accounts.filter((a) => allowedTypes.includes(a.accountType))))
        .catch((e: Error) => setLoadError(e.message)),
    ];
    if (isBankType) {
      fetches.push(
        apiGet<{ banks: Bank[] }>("/api/banks")
          .then((d) => setBanks(d.banks))
          .catch((e: Error) => setLoadError(e.message)),
      );
    }
    Promise.all(fetches);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(uid: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  function updateLine(uid: number, field: keyof Omit<PaymentLine, "uid">, value: string) {
    setLines((prev) => prev.map((l) => (l.uid === uid ? { ...l, [field]: value } : l)));
  }

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const isValid = total > 0 && voucherDate && lines.every((l) => l.accountId) && (!isBankType || bankId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setFormError("");
    setPostedNo("");
    try {
      const payload: Record<string, unknown> = {
        transactionDate: voucherDate,
        narration: narration || undefined,
        allowClosedDayOverride: allowOverride,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          amount: parseFloat(l.amount) || 0,
          description: l.description || undefined,
        })),
      };
      if (isBankType) payload.bankId = bankId;

      const endpoint = `/api/payments/${type}`;
      const result = await apiPost<Record<string, string>>(endpoint, payload);
      const docNo = String(result[config.receiptKey] ?? result.voucherNo ?? "");
      setPostedNo(docNo);
      setVoucherDate("");
      setNarration("");
      setBankId("");
      setLines([emptyLine()]);
      setAllowOverride(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to post voucher.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title={config.title} description={config.description} />
      <ApiError message={loadError} />
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        <ApiError message={formError} />
        <SuccessMessage message={postedNo ? `${config.title} voucher ${postedNo} posted.` : ""} />

        {postedNo ? (
          <div className="card rounded-lg flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-slate-600">Voucher number: <span className="font-semibold text-slate-900">{postedNo}</span></span>
            <Link href={`${config.printBase}/print/${encodeURIComponent(postedNo)}`} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Print View
            </Link>
          </div>
        ) : null}

        {/* Voucher Header */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Voucher Header</h2>
          </div>
          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="form-label" htmlFor="voucherDate">Date *</label>
                <input id="voucherDate" type="date" required value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label" htmlFor="narration">Narration</label>
                <input id="narration" type="text" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional" className="form-input" />
              </div>
              {isBankType ? (
                <div>
                  <label className="form-label" htmlFor="bankId">Bank *</label>
                  <select id="bankId" required value={bankId} onChange={(e) => setBankId(e.target.value)} className="form-input">
                    <option value="">Select Bank</option>
                    {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex items-end pb-1">
                  <p className="text-xs text-slate-500">{config.systemLabel}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Payment Lines */}
        <section className="card rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payment Lines</h2>
            </div>
            <button type="button" onClick={addLine} className="btn-primary-sm">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Account</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Description</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  <th className="whitespace-nowrap px-2.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line) => (
                  <tr key={line.uid} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-2.5 py-2">
                      <select required value={line.accountId} onChange={(e) => updateLine(line.uid, "accountId", e.target.value)} className="tbl-select w-64">
                        <option value="">Select Account</option>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2.5 py-2">
                      <input type="text" value={line.description} onChange={(e) => updateLine(line.uid, "description", e.target.value)} placeholder="Description" className="tbl-input w-48" />
                    </td>
                    <td className="px-2.5 py-2">
                      <input type="number" min="0.01" step="0.01" required value={line.amount} onChange={(e) => updateLine(line.uid, "amount", e.target.value)} className="tbl-input w-28 text-right" />
                    </td>
                    <td className="px-2.5 py-2">
                      <button type="button" onClick={() => removeLine(line.uid)} disabled={lines.length <= 1} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 flex items-center justify-end">
            <div className="rounded-lg bg-blue-700 p-3 min-w-[160px]">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">Total</div>
              <div className="mt-1.5 text-lg font-bold text-white tabular-nums">{money(String(total))}</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton loading={submitting} disabled={!isValid || submitting}>Post {config.title}</SubmitButton>
          <button type="button" onClick={() => { setVoucherDate(""); setNarration(""); setBankId(""); setLines([emptyLine()]); setAllowOverride(false); setFormError(""); setPostedNo(""); }} className="btn-outline">Reset Form</button>
          <label className="flex items-center gap-2 text-xs text-slate-600 ml-auto">
            <input type="checkbox" checked={allowOverride} onChange={(e) => setAllowOverride(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Closed-day override
          </label>
        </div>
      </form>
    </>
  );
}
