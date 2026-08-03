import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";

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
import { updateChartAccount } from "../../../../server/services/master-data/master-data.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const account = await updateChartAccount(context, id, {
      code: stringField(body, "code"),
      name: stringField(body, "name"),
      accountType: stringField(body, "accountType"),
      normalBalance: stringField(body, "normalBalance"),
      parentId: optionalStringField(body, "parentId"),
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

