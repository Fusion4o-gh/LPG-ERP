export function SuccessMessage({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div
      className="rounded-lg px-3 py-2.5 text-sm font-semibold"
      style={{ background: 'linear-gradient(145deg, #E8F5E9, #C8E6C9)', color: '#1B5E20', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 2px 2px 5px rgba(0,0,0,0.08)' }}
    >
      {message}
    </div>
  );
}
