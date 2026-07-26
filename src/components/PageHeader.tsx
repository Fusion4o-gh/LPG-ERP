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
    <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="mt-1 h-5 w-1 shrink-0 rounded-full bg-[var(--flame-orange)]" aria-hidden />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gas-800 leading-tight">{title}</h1>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-sm text-steel-500 leading-snug">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 flex-wrap">{actions}</div>
      ) : null}
    </header>
  );
}
