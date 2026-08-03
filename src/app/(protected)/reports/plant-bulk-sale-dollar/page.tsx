"use client";
import { ReportTableClient } from "../ReportTableClient";
export default function PlantBulkSaleDollarPage() { return <ReportTableClient title="Plant Bulk Sale (Dollar)" description="Dollar-denominated bulk plant sales and payment status." endpoint="/api/reports/plant-bulk-sale-dollar" dataKey="rows" columns={[{ key: "transactionDate", label: "Date" }, { key: "documentNo", label: "Document" }, { key: "quantity", label: "Quantity" }, { key: "rate", label: "Rate" }, { key: "amount", label: "Amount" }, { key: "paymentStatus", label: "Payment" }]} />; }
