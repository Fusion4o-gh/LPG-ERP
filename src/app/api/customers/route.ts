import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { customerBody, customerListSelect, mapMasterRow } from "../../../server/api/master-body.ts";
import { createCustomer } from "../../../server/services/master-data/master-data.ts";
import { readJson } from "../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const customers = await prisma.customer.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : "ACTIVE" },
      orderBy: { name: "asc" },
      select: customerListSelect,
      take: 500,
    });
    return ok({ customers: customers.map(mapMasterRow) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const customer = await createCustomer(context, customerBody(body));
    return ok({ customer: mapMasterRow(customer) });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
