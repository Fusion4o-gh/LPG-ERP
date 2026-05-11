import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { dateField, positiveIntegerField, readJson, stringField } from "../../../../../server/api/validation.ts";
import { deleteShopOpeningBalance, updateShopOpeningBalance } from "../../../../../server/services/opening-balances/opening-balances.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const entry = await updateShopOpeningBalance(context, id, {
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    const result = await deleteShopOpeningBalance(context, id);
    return ok(result);
  } catch (error) {
    return serviceError(error);
  }
}
