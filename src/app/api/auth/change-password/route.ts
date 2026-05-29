import { prisma } from "../../../../lib/prisma.ts";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../../../../server/auth/password.ts";

function encodePassword(plain: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${hashPassword(plain, salt).toString("hex")}`;
}
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson, stringField } from "../../../../server/api/validation.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const currentPassword = stringField(body, "currentPassword");
    const newPassword = stringField(body, "newPassword");
    if (newPassword.length < 6) return fail("New password must be at least 6 characters.");

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { passwordHash: true },
    });
    if (!user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return fail("Current password is incorrect.", 401);
    }

    await prisma.user.update({
      where: { id: context.userId },
      data: { passwordHash: encodePassword(newPassword) },
    });

    return ok({ changed: true });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
