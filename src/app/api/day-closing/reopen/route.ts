import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { optionalStringField, readJson } from "../../../../server/api/validation.ts";
import { reopenBusinessDay, requestDayReopen } from "../../../../server/services/inventory/day-closing-operations.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const action = optionalStringField(body, "action") ?? "reopen";
    const input = {
      closedDate: optionalStringField(body, "closedDate"),
      reason: optionalStringField(body, "reason"),
    };
    const result = action === "request" ? await requestDayReopen(context, input) : await reopenBusinessDay(context, input);
    return ok(result);
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
