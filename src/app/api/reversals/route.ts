import { fail, serviceError } from "../../../server/api/responses.ts";
import { booleanField, dateField, optionalStringField, readJson, stringField } from "../../../server/api/validation.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { createReversalStub } from "../../../server/services/reversals/reversal-policy.ts";

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    await createReversalStub(context, {
      kind: stringField(body, "kind") as never,
      documentNo: stringField(body, "documentNo"),
      reversalDate: dateField(body, "reversalDate"),
      reason: optionalStringField(body, "reason"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return Response.json({ success: true });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}

