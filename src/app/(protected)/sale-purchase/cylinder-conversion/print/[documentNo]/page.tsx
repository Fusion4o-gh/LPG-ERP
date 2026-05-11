import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function CylinderConversionPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="cylinder-conversion" documentNo={documentNo} />;
}
