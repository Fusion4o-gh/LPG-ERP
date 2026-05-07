import { OperationForm } from "@/components/OperationForm";

export default function BankReceiptPage() {
  return (
    <OperationForm
      title="Bank Receipt"
      description="Receive customer payment into bank. API creates balanced bank receipt voucher and audit log."
      endpoint="/api/payments/bank-receipt"
      submitLabel="Post Bank Receipt"
      printableDocumentType="bank-receipt"
      printableHrefBase="/payments/bank-receipt"
      fields={[
        { name: "customerId", label: "Customer", type: "select", lookup: "customers", required: true },
        { name: "bankId", label: "Bank", type: "select", lookup: "banks", required: true },
        { name: "amount", label: "Amount", type: "number", min: 1, required: true },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
