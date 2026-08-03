import { fail, serviceError } from "../../../server/api/responses.ts";
import { booleanField, dateField, optionalStringField, readJson, stringField } from "../../../server/api/validation.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { createReversalStub, listReversals } from "../../../server/services/reversals/reversal-policy.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return Response.json({ success: true, reversals: await listReversals(context) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const result = await createReversalStub(context, {
      kind: stringField(body, "kind") as never,
      documentNo: stringField(body, "documentNo"),
      reversalDate: dateField(body, "reversalDate"),
      reason: optionalStringField(body, "reason"),
      allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
    });
    return Response.json({ success: true, reversalNo: result.reversalNo, voucherNo: result.voucher?.voucherNo ?? null, stockEntryCount: result.stockEntries.length });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}

