import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { createChartAccount } from "../../../server/services/master-data/master-data.ts";
import { optionalStringField, readJson, stringField } from "../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const accounts = await prisma.chartAccount.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : "ACTIVE" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, accountType: true, normalBalance: true, parentId: true, level: true, status: true, isSystem: true },
      take: 300,
    });
    return ok({ accounts });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const account = await createChartAccount(context, {
      code: stringField(body, "code"),
      name: stringField(body, "name"),
      parentId: optionalStringField(body, "parentId"),
      accountType: stringField(body, "accountType"),
      normalBalance: stringField(body, "normalBalance"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ account });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
