import { prisma } from "../../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../../server/api/responses.ts";
import { approvePhysicalCount } from "../../../../../../server/services/warehouse/physical-count.ts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;

    const result = await prisma.$transaction((tx) =>
      approvePhysicalCount(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        userId: context.userId,
        countId: id,
      }),
    );

    return ok({ count: result });
  } catch (error) {
    return serviceError(error);
  }
}
