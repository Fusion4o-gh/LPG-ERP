import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const company = await prisma.company.findUniqueOrThrow({
      where: { id: context.companyId },
      select: { id: true, legalName: true, tradeName: true, baseCurrency: true, locale: true, timeZone: true },
    });
    return ok({ company });
  } catch (error) {
    return serviceError(error);
  }
}
