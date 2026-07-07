import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function PurchaseReturnOtherPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="purchase-return-other" documentNo={documentNo} />;
}
