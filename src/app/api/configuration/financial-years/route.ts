import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { dateField, readJson, stringField } from "../../../../server/api/validation.ts";
import { createFinancialYear, listFinancialYears } from "../../../../server/services/company/financial-years.ts";

export async function GET(request: Request) {
  try { return ok({ financialYears: await listFinancialYears(await getRequestContext(request)) }); } catch (error) { return serviceError(error); }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const financialYear = await createFinancialYear(context, { label: stringField(body, "label"), startsOn: dateField(body, "startsOn"), endsOn: dateField(body, "endsOn"), isActive: body.isActive === undefined ? undefined : body.isActive === true });
    return ok({ financialYear });
  } catch (error) {
    return error instanceof Error && /required|valid date|on or after|overlap/.test(error.message) ? fail(error.message) : serviceError(error);
  }
}
