import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { dateField, positiveIntegerField, readJson, stringField } from "../../../../server/api/validation.ts";
import { createShopOpeningBalance, listShopOpeningBalances } from "../../../../server/services/opening-balances/opening-balances.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const entries = await listShopOpeningBalances(context);
    return ok({ entries });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const entry = await createShopOpeningBalance(context, {
      itemId: stringField(body, "itemId"),
      cylinderState: stringField(body, "cylinderState"),
      quantity: positiveIntegerField(body, "quantity"),
      transactionDate: dateField(body, "transactionDate"),
    });
    return ok({ entry });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
