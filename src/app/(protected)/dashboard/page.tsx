import { PageHeader } from "@/components/PageHeader";
import { DashboardClient } from "./DashboardClient";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Operational snapshot for today." />
      <DashboardClient />
    </>
  );
}
