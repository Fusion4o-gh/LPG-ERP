"use client";

import { useState } from "react";
import { OperationForm } from "@/components/OperationForm";
import { MultiLinePaymentForm } from "@/components/MultiLinePaymentForm";

export default function CashPaymentAddPage() {
  const [mode, setMode] = useState<"multi" | "simple">("multi");

  return (
    <>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode("multi")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === "multi" ? "bg-blue-700 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
        >
          Multi-line
        </button>
        <button
          onClick={() => setMode("simple")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === "simple" ? "bg-blue-700 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
        >
          Simple
        </button>
      </div>

      {mode === "multi" ? (
        <MultiLinePaymentForm type="cash-payment" />
      ) : (
        <OperationForm
          title="Cash Payment (Simple)"
          description="Pay vendor by cash. Creates balanced cash payment voucher."
          endpoint="/api/payments/cash-payment"
          submitLabel="Post Cash Payment"
          printableDocumentType="cash-payment"
          printableHrefBase="/payments/cash-payment"
          balancePreview="cash"
          fields={[
            { name: "vendorId", label: "Vendor", type: "select", lookup: "vendors", required: true },
            { name: "amount", label: "Amount", type: "number", min: 1, required: true },
            { name: "transactionDate", label: "Date", type: "date", required: true },
            { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
          ]}
        />
      )}
    </>
  );
}
