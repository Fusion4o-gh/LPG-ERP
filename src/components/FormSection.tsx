export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="accent-section-header">
        <div className="accent-bar" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-steel-600">{title}</h2>
      </div>
      <div className="bg-white p-3.5">{children}</div>
    </section>
  );
}
