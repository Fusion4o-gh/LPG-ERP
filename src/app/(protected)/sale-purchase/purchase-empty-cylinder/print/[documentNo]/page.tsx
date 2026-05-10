import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function PurchaseEmptyCylinderPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="purchase-empty-cylinder" documentNo={documentNo} />;
}
