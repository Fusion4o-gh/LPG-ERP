export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card rounded-xl overflow-hidden">
      <div className="accent-section-header">
        <div className="accent-bar" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
