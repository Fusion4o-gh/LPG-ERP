import { MasterDataManager } from "@/components/MasterDataManager";

export function PurchaseContractsPage({ changeRateSupplier = false }: { changeRateSupplier?: boolean } = {}) {
  return <MasterDataManager
    title={changeRateSupplier ? "Change Rate & Supplier" : "Purchase Contracts"}
    description={changeRateSupplier ? "Update the supplier and rate on an existing local purchase contract with audit history." : "Register local LPG purchase commitments with vendor, product, quantity, rate, and delivery tracking."}
    endpoint="/api/import/purchase-contracts"
    dataKey="purchaseContracts"
    fields={[
      { name: "contractNo", label: "Contract no.", type: "text" },
      { name: "contractDate", label: "Contract date", type: "date", required: true },
      { name: "vendorId", label: "Vendor", type: "select", optionSource: { endpoint: "/api/vendors", dataKey: "vendors", labelKey: "name" }, required: true },
      { name: "productId", label: "Bulk product", type: "select", optionSource: { endpoint: "/api/configuration/bulk-products", dataKey: "bulkProducts", labelKey: "name" }, required: true },
      { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.001 },
      { name: "unit", label: "Unit", type: "select", options: ["MT", "KG"], required: true },
      { name: "rate", label: "Rate", type: "number", required: true, min: 0 },
      { name: "amountPkr", label: "Amount PKR", type: "number", min: 0 },
      { name: "status", label: "Status", type: "select", options: ["OPEN", "CLOSED", "CANCELLED", "APPROVED", "DISAPPROVED"] },
      { name: "remarks", label: "Remarks", type: "text" },
    ]}
    columns={[
      { key: "contractNo", label: "Contract" },
      { key: "contractDate", label: "Date" },
      { key: "vendorName", label: "Vendor" },
      { key: "productName", label: "Product" },
      { key: "quantity", label: "Qty" },
      { key: "deliveredQty", label: "Delivered" },
      { key: "amountPkr", label: "PKR" },
      { key: "status", label: "Status" },
    ]}
  />;
}
