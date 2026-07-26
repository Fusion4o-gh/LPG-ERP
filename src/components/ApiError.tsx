export function ApiError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div role="alert" className="skeu-alert-error rounded-md px-3 py-2 text-sm font-semibold">
      {message}
    </div>
  );
}
