import { PageHeader } from "@/components/PageHeader";

const cards = ["Today Sales", "Cash Position", "Receivables", "Payables", "Filled Stock", "Empty Stock", "Pending Cylinder Returns"];

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Operational snapshot placeholders. Live summaries come after transaction UI stabilizes." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <section key={card} className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">{card}</div>
            <div className="mt-3 text-2xl font-semibold text-slate-950">--</div>
          </section>
        ))}
      </div>
      <section className="mt-5 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        Track Purchase Filled Cylinder, Sale LPG, Complete Day Sale, Cylinder Return, Stock Ledger, Customer Cylinder Balance, and payments from sidebar.
      </section>
    </>
  );
}
