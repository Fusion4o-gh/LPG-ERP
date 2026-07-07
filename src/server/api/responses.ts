export function ok(data: Record<string, unknown> = {}) {
  return Response.json({ success: true, ...data });
}

export function fail(message: string, status = 400, code = "BAD_REQUEST") {
  return Response.json({ success: false, error: { code, message } }, { status });
}

function isInternalError(error: Error) {
  // Prisma client errors carry clientVersion and expose schema/query details.
  const isPrismaError = error.name.startsWith("PrismaClient") || "clientVersion" in error;
  if (!isPrismaError) return false;
  // P2025 (record not found) is a routine, user-facing outcome.
  return (error as { code?: string }).code !== "P2025";
}

export function serviceError(error: unknown) {
  if (!(error instanceof Error)) {
    return fail("Unexpected server error.", 500, "INTERNAL_ERROR");
  }
  if (error.message === "Authentication required.") {
    return fail(error.message, 401, "UNAUTHENTICATED");
  }
  if (isInternalError(error)) {
    console.error("Internal service error:", error);
    return fail("Unexpected server error.", 500, "INTERNAL_ERROR");
  }
  const status = /permission/i.test(error.message) ? 403 : 400;
  const code = status === 403 ? "FORBIDDEN" : "BAD_REQUEST";
  return fail(error.message, status, code);
}
