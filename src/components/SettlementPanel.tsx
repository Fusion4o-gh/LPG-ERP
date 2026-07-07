"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import type { SettlementFields, ReceiveMode } from "@/lib/settlement";
import { calculateBillTotals, calculatePaymentTotals } from "@/lib/settlement";

type BankOption = { id: string; name: string };

export function SettlementPanel({
  title,
  variant = "receipt",
  totalBill,
  fields,
  onChange,
  banks = [],
  showGasReturn = false,
  gasReturn,
  onGasReturnChange,
}: {
  title?: string;
  variant?: "receipt" | "payment";
  totalBill: number;
  fields: SettlementFields;
  onChange: (patch: Partial<SettlementFields>) => void;
  banks?: BankOption[];
  showGasReturn?: boolean;
  gasReturn?: { returnGasKg: string; rate: string };
  onGasReturnChange?: (patch: Partial<{ returnGasKg: string; rate: string }>) => void;
}) {
  const isPayment = variant === "payment";
  const panelTitle = title ?? (isPayment ? "Bill Details & Settlement" : "Amount Received & Settlement");
  const amountLabel = isPayment ? "Amount Paid" : "Amount Received";
  const modeLabel = isPayment ? "Pay Mode" : "Receive Mode";
  const bill = isPayment ? calculatePaymentTotals(totalBill, fields) : calculateBillTotals(totalBill, fields);
  const [balances, setBalances] = useState<{ cashInHand: number; bankBalance: number | null } | null>(null);

  useEffect(() => {
    const params = fields.bankId ? `?bankId=${fields.bankId}` : "";
    apiGet<{ cashInHand: number; bankBalance: number | null }>(`/api/accounting/balances${params}`)
      .then(setBalances)
      .catch(() => setBalances(null));
  }, [fields.bankId, isPayment]);

  const gasReturnTotal =
    showGasReturn && gasReturn
      ? Math.max(0, Number(gasReturn.returnGasKg || 0)) * Math.max(0, Number(gasReturn.rate || 0))
      : 0;

  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
        <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60 shrink-0" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{panelTitle}</h2>
      </div>
      <div className="p-5 space-y-5">
        {showGasReturn && gasReturn && onGasReturnChange ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="form-label">Return Gas (KG)</label>
              <input
                type="number"
                min="0"
                value={gasReturn.returnGasKg}
                onChange={(e) => onGasReturnChange({ returnGasKg: e.target.value })}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Rate</label>
              <input
                type="number"
                min="0"
                value={gasReturn.rate}
                onChange={(e) => onGasReturnChange({ rate: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gas Return Total</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">{gasReturnTotal.toFixed(2)}</div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Bill</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">{bill.totalBill.toFixed(2)}</div>
          </div>
          <div>
            <label className="form-label">Discount</label>
            <input
              type="number"
              min="0"
              value={fields.discount}
              onChange={(e) => onChange({ discount: e.target.value })}
              className="form-input"
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Net Bill</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">{bill.netBill.toFixed(2)}</div>
          </div>
          {isPayment ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Balance Due</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-amber-900">{bill.balanceDue.toFixed(2)}</div>
            </div>
          ) : (
            <div>
              <label className="form-label">{amountLabel}</label>
              <input
                type="number"
                min="0"
                value={fields.amountReceived}
                onChange={(e) => onChange({ amountReceived: e.target.value })}
                className="form-input"
              />
            </div>
          )}
        </div>

        {isPayment ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Bank Payment</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="form-label">Bank Name</label>
                  <select value={fields.bankId} onChange={(e) => onChange({ bankId: e.target.value })} className="form-input">
                    <option value="">Select bank</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Cheque No</label>
                  <input value={fields.chequeNo} onChange={(e) => onChange({ chequeNo: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Cheque Date</label>
                  <input
                    type="date"
                    value={fields.chequeDate}
                    onChange={(e) => onChange({ chequeDate: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    min="0"
                    value={fields.bankAmount}
                    onChange={(e) => onChange({ bankAmount: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Banks (Balance)</div>
                  <div className="mt-1 font-bold tabular-nums text-slate-800">{(balances?.bankBalance ?? 0).toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cash Payment</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    min="0"
                    value={fields.cashAmount}
                    onChange={(e) => onChange({ cashAmount: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cash In Hand (Balance)</div>
                  <div className="mt-1 font-bold tabular-nums text-slate-800">{(balances?.cashInHand ?? 0).toFixed(2)}</div>
                </div>
                <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Paid</div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">
                    {"amountPaid" in bill ? bill.amountPaid.toFixed(2) : "0.00"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="form-label">{modeLabel}</label>
              <select
                value={fields.receiveMode}
                onChange={(e) => onChange({ receiveMode: e.target.value as ReceiveMode })}
                className="form-input"
              >
                <option value="Credit">Credit</option>
                <option value="Cash">Cash</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            {fields.receiveMode === "Bank" ? (
              <>
                <div>
                  <label className="form-label">Bank</label>
                  <select value={fields.bankId} onChange={(e) => onChange({ bankId: e.target.value })} className="form-input">
                    <option value="">Select bank</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Cheque / DD No</label>
                  <input value={fields.chequeNo} onChange={(e) => onChange({ chequeNo: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Cheque Date</label>
                  <input
                    type="date"
                    value={fields.chequeDate}
                    onChange={(e) => onChange({ chequeDate: e.target.value })}
                    className="form-input"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 sm:col-span-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Balance Due</div>
                <div className="mt-1 text-lg font-bold tabular-nums text-amber-900">{bill.balanceDue.toFixed(2)}</div>
              </div>
            )}
          </div>
        )}

        {!isPayment && balances ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cash In Hand</div>
              <div className="mt-1 font-bold tabular-nums text-slate-800">{balances.cashInHand.toFixed(2)}</div>
            </div>
            {fields.receiveMode === "Bank" && balances.bankBalance !== null ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bank Balance</div>
                <div className="mt-1 font-bold tabular-nums text-slate-800">{balances.bankBalance.toFixed(2)}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
