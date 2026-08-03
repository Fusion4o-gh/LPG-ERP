import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createPlantSale, listPlantSales } from "../../../../server/services/plant/plant-sales.ts";
export async function GET(request: Request) { try { const url = new URL(request.url); return ok({ plantSales: await listPlantSales(await getRequestContext(request), url.searchParams.get("type") || undefined) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ plantSale: await createPlantSale(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|non-negative|greater/.test(error.message) ? fail(error.message) : serviceError(error); } }
