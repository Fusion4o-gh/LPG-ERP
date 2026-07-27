import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function DeliveryChallanPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="delivery-challan" documentNo={documentNo} />;
}
