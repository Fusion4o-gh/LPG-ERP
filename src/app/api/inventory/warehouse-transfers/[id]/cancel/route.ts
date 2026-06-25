import { prisma } from "../../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../../server/api/responses.ts";
import { cancelWarehouseTransfer } from "../../../../../../server/services/warehouse/warehouse-transfer.ts";
import { optionalStringField, readJson } from "../../../../../../server/api/validation.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const body = await readJson(request);
    const remarks = optionalStringField(body, "remarks");

    const transfer = await prisma.$transaction((tx) =>
      cancelWarehouseTransfer(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        userId: context.userId,
        id,
        remarks,
      }),
    );

    return ok({ transfer });
  } catch (error) {
    if (error instanceof Error && error.message === "Warehouse transfer not found.") {
      return fail("Warehouse transfer not found.", 404, "NOT_FOUND");
    }
    return serviceError(error);
  }
}
