export function ok(data: Record<string, unknown> = {}) {
  return Response.json({ success: true, ...data });
}

export function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return Response.json({ success: false, error: { code, message } }, { status });
}

export function serviceError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = /permission/i.test(message) ? 403 : 400;
  const code = status === 403 ? "FORBIDDEN" : "BAD_REQUEST";
  return fail(message, status, code);
}
