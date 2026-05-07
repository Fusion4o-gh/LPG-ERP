import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function BankReceiptPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="bank-receipt" documentNo={documentNo} />;
}
