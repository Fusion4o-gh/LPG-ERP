import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { createArea, listAreas, listCities } from "../../../../server/services/master-data/master-data.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const [areas, cities] = await Promise.all([listAreas(context, includeAll), listCities(context, true)]);
    return ok({ areas: areas.map((area) => ({ ...area, cityName: area.city.name })), cities });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const area = await createArea(context, {
      cityId: stringField(body, "cityId"),
      name: stringField(body, "name"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ area });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
