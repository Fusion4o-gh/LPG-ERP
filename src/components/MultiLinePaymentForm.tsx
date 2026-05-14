"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { ApiError } from "./ApiError";
import { PageHeader } from "./PageHeader";
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
    <section>
      <PageHeader title={config.title} description={config.description} />
      <ApiError message={loadError} />

      <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-blue-700">New {config.title} Voucher</h2>

        <form id={formId} onSubmit={handleSubmit}>
          {/* Header row */}
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                required
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Narration</label>
              <input
                type="text"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Optional narration"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {isBankType ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Bank</label>
                <select
                  required
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select Bank</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-end">
                <p className="text-xs text-slate-500">{config.systemLabel}</p>
              </div>
            )}
          </div>

          {/* Lines table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-blue-50 text-left">
                <tr>
                  <th className="border border-blue-100 px-3 py-2">Account</th>
                  <th className="border border-blue-100 px-3 py-2">Description</th>
                  <th className="border border-blue-100 px-3 py-2 text-right">Amount</th>
                  <th className="border border-blue-100 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.uid}>
                    <td className="border border-slate-200 px-2 py-1">
                      <select
                        required
                        value={line.accountId}
                        onChange={(e) => updateLine(line.uid, "accountId", e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">Select Account</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border border-slate-200 px-2 py-1">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(line.uid, "description", e.target.value)}
                        placeholder="Description"
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 w-36">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={line.amount}
                        onChange={(e) => updateLine(line.uid, "amount", e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.uid)}
                        disabled={lines.length <= 1}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-medium text-sm">
                <tr>
                  <td className="border border-slate-200 px-3 py-2" colSpan={2}>
                    <button
                      type="button"
                      onClick={addLine}
                      className="rounded px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
                    >
                      + Add Row
                    </button>
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-right">{money(String(total))}</td>
                  <td className="border border-slate-200 px-3 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={allowOverride}
                onChange={(e) => setAllowOverride(e.target.checked)}
                className="rounded"
              />
              Closed-day override
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="rounded-md bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {submitting ? "Posting..." : `Post ${config.title}`}
            </button>
            {postedNo ? (
              <Link
                href={`${config.printBase}/print/${encodeURIComponent(postedNo)}`}
                className="text-sm text-blue-700 underline"
              >
                Print {postedNo}
              </Link>
            ) : null}
          </div>
        </form>

        <ApiError message={formError} />
        <SuccessMessage message={postedNo ? `${config.title} voucher ${postedNo} posted.` : ""} />
      </div>
    </section>
  );
}
