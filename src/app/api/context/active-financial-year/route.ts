import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const financialYear = await prisma.financialYear.findUniqueOrThrow({
      where: { id: context.financialYearId },
      select: { id: true, label: true, startsOn: true, endsOn: true, isActive: true, isClosed: true },
    });
    return ok({ financialYear });
  } catch (error) {
    return serviceError(error);
  }
}
