export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-4 min-w-0">
        <div
          className="mt-1 h-7 w-1 shrink-0 rounded-full"
          style={{ background: "var(--fusion-gradient)" }}
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 leading-tight">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-slate-500 leading-relaxed">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 flex-wrap">{actions}</div>
      ) : null}
    </header>
  );
}
