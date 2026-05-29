import { prisma } from "../../../../lib/prisma.ts";
import { verifyPassword } from "../../../../server/auth/password.ts";
import { createSession, sessionCookieValue } from "../../../../server/auth/session.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const loginId = stringField(body, "loginId");
    const password = stringField(body, "password");
    const financialYearId = typeof body.financialYearId === "string" && body.financialYearId ? body.financialYearId : undefined;
    const user = await prisma.user.findFirst({
      where: { loginId, status: "ACTIVE" },
      select: { id: true, name: true, loginId: true, companyId: true, financialYearId: true, passwordHash: true },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return fail("Invalid login ID or password.", 401, "INVALID_LOGIN");
    }

    if (financialYearId) {
      const financialYear = await prisma.financialYear.findFirst({
        where: { id: financialYearId, companyId: user.companyId, isClosed: false },
      });
      if (!financialYear) return fail("Selected financial year is not available.");
      await prisma.user.update({ where: { id: user.id }, data: { financialYearId } });
    }

    const session = await createSession(user.id);
    return Response.json(
      { success: true, user: { id: user.id, name: user.name, loginId: user.loginId } },
      { headers: { "set-cookie": sessionCookieValue(session.sessionToken) } },
    );
  } catch (error) {
    return serviceError(error);
  }
}
