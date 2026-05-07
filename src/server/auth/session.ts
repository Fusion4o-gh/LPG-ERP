import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.ts";

export const SESSION_COOKIE = "lpg_erp_session";

export type SessionContext = {
  userId: string;
  companyId: string;
  financialYearId: string;
};

export async function createSession(userId: string) {
  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 12);

  return prisma.session.create({
    data: { userId, sessionToken, expires },
  });
}

export function sessionCookieValue(token: string) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}`;
}

export function clearSessionCookieValue() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function tokenFromCookieHeader(cookieHeader?: string | null) {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
}

export async function getSessionContextFromToken(token?: string | null): Promise<SessionContext | null> {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        include: { financialYear: true },
      },
    },
  });

  if (!session || session.expires <= new Date() || session.user.status !== "ACTIVE") {
    return null;
  }

  const financialYear =
    session.user.financialYear ??
    (await prisma.financialYear.findFirst({
      where: { companyId: session.user.companyId, isActive: true, isClosed: false },
      orderBy: { startsOn: "desc" },
    }));

  if (!financialYear) {
    return null;
  }

  return {
    userId: session.userId,
    companyId: session.user.companyId,
    financialYearId: financialYear.id,
  };
}

export async function getSessionContextFromRequest(request: Request) {
  return getSessionContextFromToken(tokenFromCookieHeader(request.headers.get("cookie")));
}

export async function deleteSessionByToken(token?: string | null) {
  if (!token) {
    return;
  }
  await prisma.session.deleteMany({ where: { sessionToken: token } });
}

export function readTokenFromRequest(request: Request) {
  return tokenFromCookieHeader(request.headers.get("cookie"));
}
