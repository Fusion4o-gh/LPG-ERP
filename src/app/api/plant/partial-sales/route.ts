import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createPartialPlantSale, listPartialPlantSales } from "../../../../server/services/plant/partial-plant-sale.ts";

export async function GET(request: Request) { try { return ok({ partialPlantSales: await listPartialPlantSales(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ partialPlantSale: await createPartialPlantSale(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|non-negative|greater/.test(error.message) ? fail(error.message) : serviceError(error); } }
