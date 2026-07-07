import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function PurchaseReturnCylinderPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="purchase-return-cylinder" documentNo={documentNo} />;
}
