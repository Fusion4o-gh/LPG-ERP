export function SuccessMessage({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <div role="status" className="skeu-alert-success rounded-md px-3 py-2 text-sm font-semibold">
      {message}
    </div>
  );
}
