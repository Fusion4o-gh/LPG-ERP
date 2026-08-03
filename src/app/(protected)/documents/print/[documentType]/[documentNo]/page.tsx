import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function GenericTransactionPrintPage({ params }: { params: Promise<{ documentType: string; documentNo: string }> }) {
  const { documentType, documentNo } = await params;
  return <PrintableTransactionDocument documentType={documentType} documentNo={documentNo} />;
}

