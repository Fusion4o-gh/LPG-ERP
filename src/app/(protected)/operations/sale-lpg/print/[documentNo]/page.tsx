import { PrintableTransactionDocument } from "@/components/PrintableTransactionDocument";

export default async function SaleLpgPrintPage({ params }: { params: Promise<{ documentNo: string }> }) {
  const { documentNo } = await params;
  return <PrintableTransactionDocument documentType="sale-lpg" documentNo={documentNo} />;
}
