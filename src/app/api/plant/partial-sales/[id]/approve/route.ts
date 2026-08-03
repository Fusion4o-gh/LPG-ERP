import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../../server/api/responses.ts";
import { readJson } from "../../../../../../server/api/validation.ts";
import { approvePartialPlantSale } from "../../../../../../server/services/plant/partial-plant-sale.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const body = await readJson(request); return ok({ partialPlantSale: await approvePartialPlantSale(await getRequestContext(request), (await params).id, body.approved !== false) }); } catch (error) { return error instanceof Error && /not found|changed|approved/.test(error.message) ? fail(error.message) : serviceError(error); } }
