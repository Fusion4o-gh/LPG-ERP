import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { createChartAccount } from "../../../server/services/master-data/master-data.ts";
import { optionalStringField, readJson, stringField } from "../../../server/api/validation.ts";

function optionalNumber(body: Record<string, unknown>, name: string) {
  const value = body[name];
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name} must be a non-negative number.`);
  return number;
}

function optionalBoolean(body: Record<string, unknown>, name: string) {
  const value = body[name];
  if (value === undefined || value === null || value === "") return false;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw new Error(`${name} must be a boolean.`);
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const accounts = await prisma.chartAccount.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : "ACTIVE" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, address: true, isSubLedger: true, debitLimit: true, creditLimit: true, openingBalance: true, openingBalanceType: true, isBalanceSheet: true, phone: true, mobile: true, ntn: true, strn: true, email: true, contactPerson: true, accountType: true, normalBalance: true, parentId: true, level: true, status: true, isSystem: true },
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
      accountAddress: optionalStringField(body, "address"),
      isSubLedger: optionalBoolean(body, "isSubLedger"),
      debitLimit: optionalNumber(body, "debitLimit"),
      creditLimit: optionalNumber(body, "creditLimit"),
      accountOpeningBalance: optionalNumber(body, "openingBalance"),
      accountOpeningBalanceType: optionalStringField(body, "openingBalanceType"),
      isBalanceSheet: optionalBoolean(body, "isBalanceSheet"),
      accountPhone: optionalStringField(body, "phone"),
      accountMobile: optionalStringField(body, "mobile"),
      accountNtn: optionalStringField(body, "ntn"),
      accountStrn: optionalStringField(body, "strn"),
      accountEmail: optionalStringField(body, "email"),
      accountContactPerson: optionalStringField(body, "contactPerson"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ account });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
