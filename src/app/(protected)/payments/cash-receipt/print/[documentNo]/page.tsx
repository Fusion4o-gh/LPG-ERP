import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function CashReceiptPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="cash-receipt" documentNo={documentNo} />;
}
