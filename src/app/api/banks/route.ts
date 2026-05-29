import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { createBank } from "../../../server/services/master-data/master-data.ts";
import { optionalStringField, readJson, stringField } from "../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const banks = await prisma.bank.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        accountNumber: true,
        phone: true,
        address: true,
        email: true,
        openingBalance: true,
        openingBalanceType: true,
        status: true,
      },
      take: 100,
    });
    return ok({ banks });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const bank = await createBank(context, {
      name: stringField(body, "name"),
      accountNumber: optionalStringField(body, "accountNumber"),
      phone: optionalStringField(body, "phone"),
      address: optionalStringField(body, "address"),
      email: optionalStringField(body, "email"),
      openingBalance: optionalStringField(body, "openingBalance"),
      openingBalanceType: optionalStringField(body, "openingBalanceType"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ bank });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
