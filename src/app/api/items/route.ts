import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { createItem } from "../../../server/services/master-data/master-data.ts";
import { optionalPositiveNumberField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const items = await prisma.item.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : "ACTIVE" },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        categoryId: true,
        brandId: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        cylinderWeightKg: true,
        defaultSecurity: true,
        status: true,
      },
      take: 100,
    });
    return ok({
      items: items.map((item) => ({
        ...item,
        categoryName: item.category?.name ?? "",
        brandName: item.brand?.name ?? "",
      })),
    });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const item = await createItem(context, {
      code: stringField(body, "code"),
      name: stringField(body, "name"),
      categoryId: optionalStringField(body, "categoryId"),
      brandId: optionalStringField(body, "brandId"),
      cylinderWeightKg: optionalPositiveNumberField(body, "cylinderWeightKg"),
      defaultSecurity: body.defaultSecurity === undefined ? undefined : positiveNumberField(body, "defaultSecurity"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ item });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
