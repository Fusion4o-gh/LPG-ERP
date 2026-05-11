import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { dateField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../../server/api/validation.ts";
import { createCashOpeningBalance, listCashOpeningAccounts, listCashOpeningBalances } from "../../../../server/services/opening-balances/opening-balances.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const [openings, accounts] = await Promise.all([listCashOpeningBalances(context), listCashOpeningAccounts(context)]);
    return ok({ openings, accounts });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const opening = await createCashOpeningBalance(context, {
      accountId: stringField(body, "accountId"),
      amount: positiveNumberField(body, "amount"),
      transactionDate: dateField(body, "transactionDate"),
      balanceType: optionalStringField(body, "balanceType"),
    });
    return ok({ opening });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
