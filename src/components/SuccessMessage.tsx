export function SuccessMessage({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</div>;
}
