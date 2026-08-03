import { MasterDataManager } from "@/components/MasterDataManager";

export default function DollarSalePage() {
  return (
    <MasterDataManager
      title="Dollar Sale"
      description="Record a dollar sale with optional contract matching, exchange conversion, and customer receivable posting."
      endpoint="/api/dollar/transactions"
      dataKey="dollarTransactions"
      fields={[
        { name: "txnType", label: "Transaction type", type: "select", options: ["SALE_WITH_CONTRACT", "SALE_WITHOUT_CONTRACT", "BULK_SALE"], required: true },
        { name: "customerId", label: "Customer", type: "select", optionSource: { endpoint: "/api/customers", dataKey: "customers", labelKey: "name" }, required: true },
        { name: "contractId", label: "Sale contract", type: "select", optionSource: { endpoint: "/api/import/sale-contracts", dataKey: "saleContracts", labelKey: "contractNo" } },
        { name: "productId", label: "Bulk product", type: "select", optionSource: { endpoint: "/api/configuration/bulk-products", dataKey: "bulkProducts", labelKey: "name" }, required: true },
        { name: "locationId", label: "Stock location", type: "select", optionSource: { endpoint: "/api/configuration/stock-locations", dataKey: "stockLocations", labelKey: "name" }, required: true },
        { name: "quantity", label: "Quantity", type: "number", required: true, min: 0.001 },
        { name: "unit", label: "Unit", type: "select", options: ["MT", "KG"], required: true },
        { name: "usdAmount", label: "USD amount", type: "number", required: true, min: 0.001 },
        { name: "exchangeRate", label: "Exchange rate", type: "number", required: true, min: 0.001 },
        { name: "transactionDate", label: "Transaction date", type: "date", required: true },
        { name: "remarks", label: "Remarks", type: "text" },
      ]}
      columns={[{ key: "documentNo", label: "Document" }, { key: "transactionDate", label: "Date" }, { key: "customerName", label: "Customer" }, { key: "productName", label: "Product" }, { key: "usdAmount", label: "USD" }, { key: "pkrAmount", label: "PKR" }]}
    />
  );
}
