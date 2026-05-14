export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
        <div className="h-3.5 w-0.5 rounded-full bg-blue-500/60" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
