import { prisma } from "../../../../lib/prisma.ts";
import { AuditAction } from "@prisma/client";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson, optionalStringField, stringField } from "../../../../server/api/validation.ts";
import { writeAuditLog } from "../../../../server/services/audit/audit-log.ts";

function profileSelect() {
  return { id: true, loginId: true, name: true, email: true, status: true } as const;
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const user = await prisma.user.findFirstOrThrow({ where: { id: context.userId, companyId: context.companyId }, select: profileSelect() });
    return ok({ profile: user });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const name = stringField(body, "name").trim();
    const email = optionalStringField(body, "email")?.trim() || null;
    if (!name) throw new Error("name is required.");

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirstOrThrow({ where: { id: context.userId, companyId: context.companyId }, select: profileSelect() });
      const profile = await tx.user.update({ where: { id: context.userId }, data: { name, email }, select: profileSelect() });
      await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "UserProfile", entityId: context.userId, before, after: profile });
      return profile;
    });
    return ok({ profile: result });
  } catch (error) {
    return serviceError(error);
  }
}
