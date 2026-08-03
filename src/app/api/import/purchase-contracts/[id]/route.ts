import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { readJson } from "../../../../../server/api/validation.ts";
import { updatePurchaseContract } from "../../../../../server/services/import/purchase-contracts.ts";
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) { try { return ok({ purchaseContract: await updatePurchaseContract(await getRequestContext(request), (await params).id, await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|negative|greater/.test(error.message) ? fail(error.message) : serviceError(error); } }
