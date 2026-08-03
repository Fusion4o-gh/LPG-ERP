import { ItemPriceManager } from "@/components/ItemPriceManager";

export default async function ItemPricesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemPriceManager itemId={id} />;
}
