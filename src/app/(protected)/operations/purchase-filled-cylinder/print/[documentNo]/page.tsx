import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function PurchaseFilledCylinderPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="purchase-filled-cylinder" documentNo={documentNo} />;
}
