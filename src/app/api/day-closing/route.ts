import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { dateField, optionalPositiveNumberField, optionalStringField, readJson } from "../../../server/api/validation.ts";
import { closeBusinessDay, getDayClosingStatus } from "../../../server/services/inventory/day-closing-operations.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const status = await getDayClosingStatus(context);
    return ok({ status });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const closing = await closeBusinessDay(context, {
      closedDate: dateField(body, "closedDate"),
      cashBalance: optionalPositiveNumberField(body, "cashBalance"),
      notes: optionalStringField(body, "notes"),
    });
    return ok({ closing });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}

