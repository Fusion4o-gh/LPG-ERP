"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { ApiError } from "./ApiError";

type PrintableDocument = {
  heading: string;
  type: string;
  number: string;
  date: string;
  partyLabel: string;
  partyName: string;
  lineItems: Array<Record<string, unknown>>;
  voucherLines: Array<Record<string, unknown>>;
  totals: Record<string, unknown>;
  invoiceLanguage?: string;
  generatedAt: string;
};

function display(value: unknown) {
  return String(value ?? "");
}

export function PrintableTransactionDocument({ documentType, documentNo }: { documentType: string; documentNo: string }) {
  const [document, setDocument] = useState<PrintableDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ document: PrintableDocument }>(`/api/transaction-documents/${documentType}/${encodeURIComponent(documentNo)}`)
      .then((data) => setDocument(data.document))
      .catch((err: Error) => setError(err.message));
  }, [documentNo, documentType]);

  const hasLineAmounts = document?.lineItems.some((line) => line.amount !== undefined) ?? false;
  const hasGstBreakdown = document?.lineItems.some((line) => line.exGstAmount !== undefined) ?? false;
  const hasSections = document?.lineItems.some((line) => line.section !== undefined) ?? false;

  const isUrdu = document?.invoiceLanguage === "Urdu";

  return (
    <section
      data-report-print
      className={`mx-auto max-w-4xl space-y-4 bg-white p-5 shadow-sm print:shadow-none ${isUrdu ? "gulzar-regular" : ""}`}
    >
      <div data-print-hidden className="flex justify-end">
        <button type="button" onClick={() => window.print()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Print
        </button>
      </div>
      <ApiError message={error} />
      {!document && !error ? <div className="text-sm text-slate-600">Loading printable document...</div> : null}
      {document ? (
        <>
          <header className="border-b border-slate-200 pb-4">
            <div className="text-2xl font-semibold text-slate-950">{document.heading}</div>
            <div className="mt-1 text-lg font-medium text-slate-800">{document.type}</div>
          </header>

          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-600">Document Number</dt>
              <dd className="text-slate-950">{document.number}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-600">Date</dt>
              <dd className="text-slate-950">{document.date}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-600">{document.partyLabel}</dt>
              <dd className="text-slate-950">{document.partyName || "N/A"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-600">Generated</dt>
              <dd className="text-slate-950">{new Date(document.generatedAt).toLocaleString()}</dd>
            </div>
            {document.invoiceLanguage ? (
              <div>
                <dt className="font-semibold text-slate-600">Invoice Language</dt>
                <dd className="text-slate-950">{document.invoiceLanguage}</dd>
              </div>
            ) : null}
          </dl>

          {document.lineItems.length > 0 ? (
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  {hasSections ? <th className="border border-slate-200 px-3 py-2">Section</th> : null}
                  <th className="border border-slate-200 px-3 py-2">Item</th>
                  <th className="border border-slate-200 px-3 py-2">State</th>
                  <th className="border border-slate-200 px-3 py-2">Direction</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">Quantity</th>
                  {hasLineAmounts ? <th className="border border-slate-200 px-3 py-2 text-right">Unit Price</th> : null}
                  {hasGstBreakdown ? <th className="border border-slate-200 px-3 py-2 text-right">GST</th> : null}
                  {hasGstBreakdown ? <th className="border border-slate-200 px-3 py-2 text-right">Ex-GST</th> : null}
                  {hasLineAmounts ? <th className="border border-slate-200 px-3 py-2 text-right">{hasGstBreakdown ? "Inc-GST" : "Amount"}</th> : null}
                </tr>
              </thead>
              <tbody>
                {document.lineItems.map((line) => (
                  <tr key={display(line.id)}>
                    {hasSections ? <td className="border border-slate-200 px-3 py-2">{display(line.section)}</td> : null}
                    <td className="border border-slate-200 px-3 py-2">{display(line.item)}</td>
                    <td className="border border-slate-200 px-3 py-2">{display(line.cylinderState)}</td>
                    <td className="border border-slate-200 px-3 py-2">{display(line.direction)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right">{display(line.quantity)}</td>
                    {hasLineAmounts ? <td className="border border-slate-200 px-3 py-2 text-right">{display(line.unitPrice ?? line.unitCost)}</td> : null}
                    {hasGstBreakdown ? <td className="border border-slate-200 px-3 py-2 text-right">{display(line.gstAmount)}</td> : null}
                    {hasGstBreakdown ? <td className="border border-slate-200 px-3 py-2 text-right">{display(line.exGstAmount)}</td> : null}
                    {hasLineAmounts ? <td className="border border-slate-200 px-3 py-2 text-right">{display(line.incGstAmount ?? line.amount)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="border border-slate-200 px-3 py-2">Account</th>
                <th className="border border-slate-200 px-3 py-2">Description</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Debit</th>
                <th className="border border-slate-200 px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {document.voucherLines.length > 0 ? (
                document.voucherLines.map((line) => (
                  <tr key={display(line.id)}>
                    <td className="border border-slate-200 px-3 py-2">{display(line.account)}</td>
                    <td className="border border-slate-200 px-3 py-2">{display(line.description)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right">{display(line.debit)}</td>
                    <td className="border border-slate-200 px-3 py-2 text-right">{display(line.credit)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border border-slate-200 px-3 py-3 text-slate-500" colSpan={4}>
                    No voucher lines.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="grid gap-2 border-t border-slate-200 pt-3 text-sm md:grid-cols-3">
            <div>
              <span className="font-semibold text-slate-600">Quantity: </span>
              {display(document.totals.quantity)}
            </div>
            <div>
              <span className="font-semibold text-slate-600">Total Debit: </span>
              {display(document.totals.totalDebit)}
            </div>
            <div>
              <span className="font-semibold text-slate-600">Total Credit: </span>
              {display(document.totals.totalCredit)}
            </div>
          </div>

          <footer className="border-t border-slate-200 pt-3 text-center text-[11px] text-slate-500">
            LPG Management System
          </footer>
        </>
      ) : null}
    </section>
  );
}
