import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromRequest } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit/audit-log";
import { fail, ok, serviceError } from "@/server/api/responses";

async function getAuthContext(request: Request) {
  const session = await getSessionContextFromRequest(request);
  if (!session) return null;
  return { companyId: session.companyId, userId: session.userId };
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return fail("Unauthorized.", 401);
    const { companyId, userId } = auth;

    const formData = await request.formData();
    const file = formData.get("logo") as File | null;
    if (!file) return fail("No logo file provided.");

    if (!file.type.startsWith("image/")) return fail("Only image files are allowed.");
    if (file.size > 2 * 1024 * 1024) return fail("File size must be under 2 MB.");

    const ext = file.name.split(".").pop() ?? "png";
    const fileName = `${companyId}.${ext}`;
    const publicDir = join(process.cwd(), "public", "company-logos");
    await mkdir(publicDir, { recursive: true });
    await writeFile(join(publicDir, fileName), Buffer.from(await file.arrayBuffer()));

    const logoUrl = `/company-logos/${fileName}`;

    await prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data: { logoUrl } });
      await writeAuditLog(tx, { companyId, userId, entityType: "Company", entityId: companyId, after: { logoUrl } });
    });

    return ok({ logoUrl });
  } catch (error) {
    return serviceError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return fail("Unauthorized.", 401);
    const { companyId, userId } = auth;

    await prisma.$transaction(async (tx) => {
      const before = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { logoUrl: true } });
      await tx.company.update({ where: { id: companyId }, data: { logoUrl: null } });
      await writeAuditLog(tx, { companyId, userId, entityType: "Company", entityId: companyId, before: { logoUrl: before.logoUrl ?? undefined }, after: { logoUrl: null } });
    });

    return ok({ logoUrl: null });
  } catch (error) {
    return serviceError(error);
  }
}
