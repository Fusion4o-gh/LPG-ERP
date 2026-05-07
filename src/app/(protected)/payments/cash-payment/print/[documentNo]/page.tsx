import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function CashPaymentPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="cash-payment" documentNo={documentNo} />;
}
