import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function BankPaymentPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="bank-payment" documentNo={documentNo} />;
}
