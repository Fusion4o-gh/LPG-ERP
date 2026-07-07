import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { createExpenseType, listExpenseTypes } from "../../../../server/services/master-data/master-data.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const expenseTypes = await listExpenseTypes(context, includeAll);
    const expenseParents = expenseTypes.filter((account) => account.accountType === "EXPENSE" && account.status === "ACTIVE");
    return ok({ expenseTypes: expenseTypes.map((account) => ({ ...account, parentName: account.parent?.name ?? "" })), expenseParents });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const expenseType = await createExpenseType(context, {
      code: stringField(body, "code"),
      name: stringField(body, "name"),
      parentId: optionalStringField(body, "parentId"),
      openingBalance: optionalStringField(body, "openingBalance"),
      openingBalanceType: optionalStringField(body, "openingBalanceType"),
      transactionDate: optionalStringField(body, "openingDate"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ expenseType });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
