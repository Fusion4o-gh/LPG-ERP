import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function PurchaseOtherPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="purchase-other" documentNo={documentNo} />;
}
