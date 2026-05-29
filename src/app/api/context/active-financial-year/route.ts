import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson, stringField } from "../../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const [financialYear, available] = await Promise.all([
      prisma.financialYear.findUniqueOrThrow({
        where: { id: context.financialYearId },
        select: { id: true, label: true, startsOn: true, endsOn: true, isActive: true, isClosed: true },
      }),
      prisma.financialYear.findMany({
        where: { companyId: context.companyId, isClosed: false },
        orderBy: { startsOn: "desc" },
        select: { id: true, label: true, isActive: true, startsOn: true, endsOn: true },
      }),
    ]);
    return ok({ financialYear, financialYears: available });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const financialYearId = stringField(body, "financialYearId");

    const financialYear = await prisma.financialYear.findFirst({
      where: { id: financialYearId, companyId: context.companyId, isClosed: false },
    });
    if (!financialYear) return fail("Financial year not found or is closed.");

    await prisma.user.update({
      where: { id: context.userId },
      data: { financialYearId },
    });

    return ok({ financialYear: { id: financialYear.id, label: financialYear.label } });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
