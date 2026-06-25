import { prisma } from "../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { getWarehouseTransferById } from "../../../../../server/services/warehouse/warehouse-transfer.ts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;

    const transfer = await prisma.$transaction((tx) =>
      getWarehouseTransferById(tx, { companyId: context.companyId, id }),
    );

    return ok({ transfer });
  } catch (error) {
    if (error instanceof Error && error.message === "Warehouse transfer not found.") {
      return fail("Warehouse transfer not found.", 404, "NOT_FOUND");
    }
    return serviceError(error);
  }
}
