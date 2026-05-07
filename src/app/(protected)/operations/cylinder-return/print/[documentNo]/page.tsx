import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function CylinderReturnPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="cylinder-return" documentNo={documentNo} />;
}
