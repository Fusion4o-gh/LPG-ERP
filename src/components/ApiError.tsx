export function ApiError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-sm font-semibold"
      style={{ background: 'linear-gradient(145deg, #FFEBEE, #FFCDD2)', color: '#B71C1C', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 2px 2px 5px rgba(0,0,0,0.08)' }}
    >
      {message}
    </div>
  );
}
