import { OperationForm } from "@/components/OperationForm";

export default function PurchaseFilledCylinderPage() {
  return (
    <OperationForm
      title="Purchase Filled Cylinder"
      description="Receive filled LPG cylinders from vendor. API posts stock ledger, vendor payable voucher, empty-cylinder return tracking, and audit log."
      endpoint="/api/purchases/filled-cylinder"
      submitLabel="Post Purchase"
      printableDocumentType="purchase-filled-cylinder"
      printableHrefBase="/operations/purchase-filled-cylinder"
      fields={[
        { name: "vendorId", label: "Vendor", type: "select", lookup: "vendors", required: true },
        { name: "itemId", label: "Item", type: "select", lookup: "items", required: true },
        { name: "quantity", label: "Quantity", type: "number", min: 1, required: true },
        { name: "unitCost", label: "Unit Cost", type: "number", min: 1, required: true },
        { name: "gstAmount", label: "GST Amount", type: "number", min: 0 },
        { name: "transactionDate", label: "Date", type: "date", required: true },
        { name: "allowClosedDayOverride", label: "Closed-day override", type: "checkbox" },
      ]}
    />
  );
}
