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
          style={{ background: 'linear-gradient(to bottom, #F28C28, #D97823)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 1px 1px 2px rgba(0,0,0,0.15)' }}
        />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gas-800 leading-tight" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}>{title}</h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-steel-500 leading-relaxed">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2 flex-wrap">{actions}</div>
      ) : null}
    </header>
  );
}
