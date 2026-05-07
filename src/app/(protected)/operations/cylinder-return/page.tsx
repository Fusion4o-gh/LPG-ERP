import { OperationForm } from "@/components/OperationForm";

export default function CylinderReturnPage() {
  return (
    <OperationForm
      title="Cylinder Return"
      description="Receive empty cylinders from customer. API updates empty stock ledger and Customer Cylinder Balance."
      endpoint="/api/returns/cylinder"
      submitLabel="Post Return"
      printableDocumentType="cylinder-return"
      printableHrefBase="/operations/cylinder-return"
      fields={[
        { name: "customerId", label: "Customer", type: "select", lookup: "customers", required: true },
        { name: "itemId", label: "Item", type: "select", lookup: "items", required: true },
        { name: "quantity", label: "Quantity", type: "number", min: 1, required: true },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
