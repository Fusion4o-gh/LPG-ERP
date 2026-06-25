import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../../server/api/responses.ts";
import { getPhysicalCountById } from "../../../../../server/services/warehouse/physical-count.ts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;

    const count = await prisma.$transaction((tx) =>
      getPhysicalCountById(tx, { companyId: context.companyId, id }),
    );

    return ok({ count });
  } catch (error) {
    return serviceError(error);
  }
}
