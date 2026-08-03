import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createDeliveredSale, listDeliveredSales } from "../../../../server/services/import/delivered-sales.ts";
export async function GET(request: Request) { try { return ok({ deliveredSales: await listDeliveredSales(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ deliveredSale: await createDeliveredSale(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|negative|greater|exceeds|match/.test(error.message) ? fail(error.message) : serviceError(error); } }
