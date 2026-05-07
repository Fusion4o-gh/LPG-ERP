type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T extends Record<string, unknown>>({ columns, rows, loading }: { columns: Column<T>[]; rows: T[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading...</div>;
  }

  function isNumericColumn(label: string) {
    return /(amount|balance|cash|count|credit|debit|empty|filled|movement|payable|quantity|receivable|stock|total)/i.test(label);
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-100 text-left text-slate-700">
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className={`whitespace-nowrap px-3 py-2 font-semibold ${isNumericColumn(column.label) ? "text-right" : ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-5 text-slate-500" colSpan={columns.length}>
                No records found.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="border-t border-slate-100">
                {columns.map((column) => (
                  <td key={String(column.key)} className={`whitespace-nowrap px-3 py-2 text-slate-800 ${isNumericColumn(column.label) ? "text-right tabular-nums" : ""}`}>
                    {column.render ? column.render(row) : String(row[column.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
