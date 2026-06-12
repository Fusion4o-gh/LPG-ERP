import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createVehicle, listVehicles } from "../../../../server/services/master-data/fleet-master.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    return ok({ vehicles: await listVehicles(context, includeAll) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const vehicle = await createVehicle(context, body);
    return ok({ vehicle });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
