import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { listContractShifts, shiftContract } from "../../../../server/services/import/contract-shifts.ts";

export async function GET(request: Request) { try { return ok({ contractShifts: await listContractShifts(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ contractShift: await shiftContract(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|different|match|cancelled|disapproved|exceeds|must be/.test(error.message) ? fail(error.message) : serviceError(error); } }
