import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createImportContract, listImportContracts } from "../../../../server/services/import/import-contracts.ts";

export async function GET(request: Request) { try { const context = await getRequestContext(request); return ok({ importContracts: await listImportContracts(context, new URL(request.url).searchParams.get("type") || undefined) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { const context = await getRequestContext(request); return ok({ importContract: await createImportContract(context, await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|negative|greater/.test(error.message) ? fail(error.message) : serviceError(error); } }
