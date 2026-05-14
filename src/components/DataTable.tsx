type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

function isNumericColumn(label: string) {
  return /(amount|balance|cash|count|credit|debit|empty|filled|movement|payable|quantity|receivable|stock|total)/i.test(label);
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  loading,
  stickyHeader,
}: {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  stickyHeader?: boolean;
}) {
  if (loading) {
    return (
      <div className="card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ${
                      isNumericColumn(column.label) ? "text-right" : "text-left"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((column) => (
                    <td key={String(column.key)} className="px-4 py-3">
                      <div className="h-3.5 rounded-md bg-slate-100 animate-pulse" style={{ width: isNumericColumn(column.label) ? "60%" : "80%", marginLeft: isNumericColumn(column.label) ? "auto" : undefined }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
            <tr className="bg-slate-50 border-b border-slate-200">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                    isNumericColumn(column.label) ? "text-right" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center" colSpan={columns.length}>
                  <div className="flex flex-col items-center gap-2.5">
                    <svg className="h-9 w-9 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm font-medium text-slate-400">No records found</p>
                    <p className="text-xs text-slate-300">Adjust your filters or add new data</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={String(row.id ?? index)}
                  className="hover:bg-blue-50/30 transition-colors"
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className={`whitespace-nowrap px-4 py-2.5 text-sm text-slate-700 ${
                        isNumericColumn(column.label) ? "text-right tabular-nums font-medium" : ""
                      }`}
                    >
                      {column.render ? column.render(row) : String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
