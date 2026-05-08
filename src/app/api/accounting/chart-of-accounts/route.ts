import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const accounts = await prisma.chartAccount.findMany({
      where: { companyId: context.companyId, status: "ACTIVE" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, accountType: true, normalBalance: true, level: true, isControl: true },
      take: 250,
    });
    return ok({ accounts });
  } catch (error) {
    return serviceError(error);
  }
}
