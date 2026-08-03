import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createPlantTransfer, listPlantTransfers } from "../../../../server/services/plant/plant-transfers.ts";
export async function GET(request: Request) { try { return ok({ plantTransfers: await listPlantTransfers(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ plantTransfer: await createPlantTransfer(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|greater|different/.test(error.message) ? fail(error.message) : serviceError(error); } }
