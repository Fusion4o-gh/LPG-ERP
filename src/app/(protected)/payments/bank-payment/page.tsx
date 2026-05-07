import { OperationForm } from "@/components/OperationForm";

export default function BankPaymentPage() {
  return (
    <OperationForm
      title="Bank Payment"
      description="Pay vendor from bank. API creates balanced bank payment voucher and audit log."
      endpoint="/api/payments/bank-payment"
      submitLabel="Post Bank Payment"
      printableDocumentType="bank-payment"
      printableHrefBase="/payments/bank-payment"
      fields={[
        { name: "vendorId", label: "Vendor", type: "select", lookup: "vendors", required: true },
        { name: "bankId", label: "Bank", type: "select", lookup: "banks", required: true },
        { name: "amount", label: "Amount", type: "number", min: 1, required: true },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
