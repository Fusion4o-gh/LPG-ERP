import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function EmptySalePrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="empty-sale" documentNo={documentNo} />;
}
