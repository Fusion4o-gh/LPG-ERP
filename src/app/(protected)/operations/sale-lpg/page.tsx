import { OperationForm } from "@/components/OperationForm";

export default function SaleLpgPage() {
  return (
    <OperationForm
      title="Sale LPG"
      description="Post single LPG sale. API writes customer ledger voucher, filled stock ledger, Customer Cylinder Balance, and audit log."
      endpoint="/api/sales/lpg"
      submitLabel="Post Sale"
      printableDocumentType="sale-lpg"
      printableHrefBase="/operations/sale-lpg"
      fields={[
        { name: "customerId", label: "Customer", type: "select", lookup: "customers", required: true },
        { name: "itemId", label: "Item", type: "select", lookup: "items", required: true },
        { name: "quantity", label: "Quantity", type: "number", min: 1, required: true },
        { name: "unitPrice", label: "Unit Price", type: "number", min: 1, required: true },
        { name: "gstAmount", label: "GST Amount", type: "number", min: 0 },
        { name: "securityDepositAmount", label: "Security Deposit", type: "number", min: 0 },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
