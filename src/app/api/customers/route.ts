import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { createCustomer } from "../../../server/services/master-data/master-data.ts";
import { optionalStringField, readJson, stringField } from "../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const customers = await prisma.customer.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, phone: true, cell: true, address: true, status: true },
      take: 100,
    });
    return ok({ customers });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const customer = await createCustomer(context, {
      code: stringField(body, "code"),
      name: stringField(body, "name"),
      phone: optionalStringField(body, "phone"),
      cell: optionalStringField(body, "cell"),
      address: optionalStringField(body, "address"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ customer });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
