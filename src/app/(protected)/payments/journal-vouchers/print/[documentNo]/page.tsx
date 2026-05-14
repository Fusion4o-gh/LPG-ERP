import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function JournalVoucherPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="journal-voucher" documentNo={documentNo} />;
}
