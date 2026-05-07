import { OperationForm } from "@/components/OperationForm";

export default function SecurityReceiptPage() {
  return (
    <OperationForm
      title="Security Receipt"
      description="Receive cylinder security deposit. API updates security liability and Customer Cylinder Balance."
      endpoint="/api/payments/security-receipt"
      submitLabel="Post Security Receipt"
      printableDocumentType="security-receipt"
      printableHrefBase="/payments/security-receipt"
      fields={[
        { name: "customerId", label: "Customer", type: "select", lookup: "customers", required: true },
        { name: "itemId", label: "Item", type: "select", lookup: "items", required: true },
        { name: "bankId", label: "Bank (optional)", type: "select", lookup: "banks" },
        { name: "amount", label: "Amount", type: "number", min: 1, required: true },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
