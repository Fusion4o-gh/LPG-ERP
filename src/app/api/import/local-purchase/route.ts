import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createLocalPurchase, listLocalPurchases } from "../../../../server/services/import/local-purchases.ts";
export async function GET(request: Request) { try { return ok({ localPurchases: await listLocalPurchases(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ localPurchase: await createLocalPurchase(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|negative|greater|exceeds|match/.test(error.message) ? fail(error.message) : serviceError(error); } }
