import { VoucherDetailPageClient } from "@/components/VoucherDetailPageClient";

export default async function VoucherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VoucherDetailPageClient id={id} />;
}
