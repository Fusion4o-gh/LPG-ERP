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
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--surface-border)] pb-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="mt-1 h-5 w-1 shrink-0 rounded-full bg-[var(--flame-orange)]" aria-hidden />
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight tracking-tight text-gas-800">{title}</h1>
          {description ? (
            <p className="mt-0.5 max-w-3xl text-sm text-steel-500 leading-snug">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>
      ) : null}
    </header>
  );
}
