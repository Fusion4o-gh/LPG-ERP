import { MasterDataManager } from "@/components/MasterDataManager";

export default function DollarPurchasePage() {
  return (
    <MasterDataManager
      title="Dollar Purchase"
      description="Record a dollar purchase with exchange conversion, stock movement, and a balanced voucher."
      endpoint="/api/dollar/transactions"
      dataKey="dollarTransactions"
      fields={[
        { name: "txnType", label: "Transaction type", type: "select", options: ["PURCHASE"], required: true },
        { name: "vendorId", label: "Vendor", type: "select", optionSource: { endpoint: "/api/vendors", dataKey: "vendors", labelKey: "name" }, required: true },
        { name: "productId", label: "Bulk product", type: "select", optionSource: { endpoint: "/api/configuration/bulk-products", dataKey: "bulkProducts", labelKey: "name" }, required: true },
        { name: "locationId", label: "Stock location", type: "select", optionSource: { endpoint: "/api/configuration/stock-locations", dataKey: "stockLocations", labelKey: "name" }, required: true },
        { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.001 },
        { name: "unit", label: "Unit", type: "select", options: ["MT", "KG"], required: true },
        { name: "usdAmount", label: "USD amount", type: "number", required: true, min: 0.001 },
        { name: "exchangeRate", label: "Exchange rate", type: "number", required: true, min: 0.001 },
        { name: "transactionDate", label: "Transaction date", type: "date", required: true },
        { name: "remarks", label: "Remarks", type: "text" },
      ]}
      columns={[{ key: "documentNo", label: "Document" }, { key: "transactionDate", label: "Date" }, { key: "vendorName", label: "Vendor" }, { key: "productName", label: "Product" }, { key: "usdAmount", label: "USD" }, { key: "pkrAmount", label: "PKR" }]}
    />
  );
}
