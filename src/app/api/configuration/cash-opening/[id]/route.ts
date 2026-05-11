import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { dateField, optionalStringField, positiveNumberField, readJson, stringField } from "../../../../../server/api/validation.ts";
import { deleteCashOpeningBalance, updateCashOpeningBalance } from "../../../../../server/services/opening-balances/opening-balances.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const opening = await updateCashOpeningBalance(context, id, {
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const result = await deleteCashOpeningBalance(context, id);
    return ok(result);
  } catch (error) {
    return serviceError(error);
  }
}
