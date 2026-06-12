import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createStockLocation, listStockLocations } from "../../../../server/services/master-data/fleet-master.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    return ok({ stockLocations: await listStockLocations(context, includeAll) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const stockLocation = await createStockLocation(context, body);
    return ok({ stockLocation });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
