import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function SecurityReceiptPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="security-receipt" documentNo={documentNo} />;
}
