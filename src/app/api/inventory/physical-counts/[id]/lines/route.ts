import { prisma } from "../../../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../../server/api/responses.ts";
import { arrayField, readJson, stringField } from "../../../../../../server/api/validation.ts";
import { addPhysicalCountLines } from "../../../../../../server/services/warehouse/physical-count.ts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const body = await readJson(request);

    const lines = arrayField(body, "lines").map((line) => ({
      itemId: stringField(line, "itemId"),
      cylinderState: stringField(line, "cylinderState") as "FILLED" | "EMPTY",
      countedQuantity: Number(line.countedQuantity),
      remarks: typeof line.remarks === "string" ? line.remarks : undefined,
    }));

    const result = await prisma.$transaction((tx) =>
      addPhysicalCountLines(tx, {
        companyId: context.companyId,
        userId: context.userId,
        countId: id,
        lines,
      }),
    );

    return ok({ lines: result });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
