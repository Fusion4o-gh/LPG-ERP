import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createPartialReceiving, listPartialReceivings } from "../../../../server/services/plant/partial-receiving.ts";
export async function GET(request: Request) { try { return ok({ partialReceivings: await listPartialReceivings(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ partialReceiving: await createPartialReceiving(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|non-negative|greater/.test(error.message) ? fail(error.message) : serviceError(error); } }
