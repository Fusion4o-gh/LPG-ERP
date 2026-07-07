import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Cross-site request forgery guard: state-changing API requests from a browser
// always carry an Origin header, which must match the host serving the app.
// Requests without an Origin header (server-to-server, curl) are allowed through
// and rely on session-cookie auth, which such clients do not have implicitly.
export function middleware(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.next();
  }

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return Response.json(
      { success: false, error: { code: "INVALID_ORIGIN", message: "Invalid request origin." } },
      { status: 403 },
    );
  }

  if (!host || originHost !== host) {
    return Response.json(
      { success: false, error: { code: "INVALID_ORIGIN", message: "Cross-origin request rejected." } },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
