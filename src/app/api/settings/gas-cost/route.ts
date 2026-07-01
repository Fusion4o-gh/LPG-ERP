import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getGasCostSetting, setGasCostSetting } from "../../../../server/services/pricing/gas-cost.ts";
import { positiveNumberField, readJson } from "../../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const gasCost = await getGasCostSetting(context);
    return ok({ gasCost });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const gasCost = await setGasCostSetting(context, { costPerKg: positiveNumberField(body, "costPerKg") });
    return ok({ gasCost });
  } catch (error) {
    return error instanceof Error && error.message.includes("must be") ? fail(error.message) : serviceError(error);
  }
}
