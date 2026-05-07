import { OperationForm } from "@/components/OperationForm";

export default function CashReceiptPage() {
  return (
    <OperationForm
      title="Cash Receipt"
      description="Receive customer cash. API creates balanced cash receipt voucher and audit log."
      endpoint="/api/payments/cash-receipt"
      submitLabel="Post Cash Receipt"
      printableDocumentType="cash-receipt"
      printableHrefBase="/payments/cash-receipt"
      fields={[
        { name: "customerId", label: "Customer", type: "select", lookup: "customers", required: true },
        { name: "amount", label: "Amount", type: "number", min: 1, required: true },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
