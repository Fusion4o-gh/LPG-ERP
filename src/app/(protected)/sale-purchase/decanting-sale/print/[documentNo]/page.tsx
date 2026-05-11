import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function DecantingSalePrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="decanting-sale" documentNo={documentNo} />;
}
