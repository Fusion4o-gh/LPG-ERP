import { MapAreaClient } from "./MapAreaClient";

export default async function MapAreaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MapAreaClient userId={id} />;
}
