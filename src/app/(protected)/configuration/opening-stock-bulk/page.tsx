import { MasterDataManager } from "@/components/MasterDataManager";

export default function BulkOpeningStockPage() {
  return (
    <MasterDataManager
      title="Opening Stock (Bulk)"
      description="Set plant/location-wise opening bulk LPG stock and valuation rate for the active financial year."
      endpoint="/api/configuration/opening-stock-bulk"
      dataKey="openingStock"
      fields={[
        {
          name: "productId",
          label: "Bulk Product",
          type: "select",
          required: true,
          optionSource: { endpoint: "/api/configuration/bulk-products", dataKey: "bulkProducts" },
        },
        {
          name: "locationId",
          label: "Stock Location",
          type: "select",
          required: true,
          optionSource: { endpoint: "/api/configuration/stock-locations", dataKey: "stockLocations" },
        },
        { name: "quantity", label: "Quantity", type: "number", required: true },
        { name: "unit", label: "Unit", type: "select", required: true, options: ["MT", "KG", "LITRE"] },
        { name: "valuationRate", label: "Valuation Rate (PKR/unit)", type: "number" },
        { name: "transactionDate", label: "As Of Date", type: "date" },
      ]}
      columns={[
        { key: "productName", label: "Product" },
        { key: "locationName", label: "Location" },
        { key: "quantity", label: "Quantity" },
        { key: "unit", label: "Unit" },
        { key: "valuationRate", label: "Rate" },
        { key: "locked", label: "Locked" },
      ]}
    />
  );
}
