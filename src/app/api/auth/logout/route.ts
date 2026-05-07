import { clearSessionCookieValue, deleteSessionByToken, readTokenFromRequest } from "../../../../server/auth/session.ts";

export async function POST(request: Request) {
  await deleteSessionByToken(readTokenFromRequest(request));
  return Response.json({ success: true }, { headers: { "set-cookie": clearSessionCookieValue() } });
}
