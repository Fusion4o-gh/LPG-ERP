import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createBulkOpeningStock, listBulkOpeningStock } from "../../../../server/services/opening-balances/bulk-opening-stock.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    return ok({ openingStock: await listBulkOpeningStock(context) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const entry = await createBulkOpeningStock(context, body);
    return ok({ entry });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
