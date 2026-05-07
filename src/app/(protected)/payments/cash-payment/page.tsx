import { OperationForm } from "@/components/OperationForm";

export default function CashPaymentPage() {
  return (
    <OperationForm
      title="Cash Payment"
      description="Pay vendor by cash. API creates balanced cash payment voucher and audit log."
      endpoint="/api/payments/cash-payment"
      submitLabel="Post Cash Payment"
      printableDocumentType="cash-payment"
      printableHrefBase="/payments/cash-payment"
      fields={[
        { name: "vendorId", label: "Vendor", type: "select", lookup: "vendors", required: true },
        { name: "amount", label: "Amount", type: "number", min: 1, required: true },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
