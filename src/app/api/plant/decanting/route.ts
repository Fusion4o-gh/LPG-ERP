import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createPlantDecanting, listPlantDecantings } from "../../../../server/services/plant/plant-decanting.ts";
export async function GET(request: Request) { try { return ok({ plantDecantings: await listPlantDecantings(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ plantDecanting: await createPlantDecanting(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|non-negative|greater|different/.test(error.message) ? fail(error.message) : serviceError(error); } }
