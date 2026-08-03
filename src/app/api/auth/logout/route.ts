import { AuditAction } from "@prisma/client";
import { prisma } from "../../../../lib/prisma.ts";
import { clearSessionCookieValue, deleteSessionByToken, readTokenFromRequest } from "../../../../server/auth/session.ts";

export async function POST(request: Request) {
  const token = readTokenFromRequest(request);
  if (token) {
    const session = await prisma.session.findUnique({ where: { sessionToken: token }, include: { user: { select: { id: true, loginId: true, companyId: true } } } });
    if (session) {
      await prisma.auditLog.create({
        data: {
          companyId: session.user.companyId,
          userId: session.user.id,
          action: AuditAction.LOGOUT,
          entityType: "Authentication",
          entityId: session.user.id,
          after: { event: "logout", loginId: session.user.loginId },
        },
      });
    }
  }
  await deleteSessionByToken(token);
  return Response.json({ success: true }, { headers: { "set-cookie": clearSessionCookieValue() } });
}
