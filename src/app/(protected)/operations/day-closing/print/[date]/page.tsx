import { DayClosingPrintClient } from "@/components/DayClosingPrintClient";

export default async function DayClosingPrintPage({ params }: { params: Promise<{ date: string }> }) {
  return <DayClosingPrintClient date={(await params).date} />;
}
