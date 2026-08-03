import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../../server/api/responses.ts";
import { closePartialPlantSale } from "../../../../../../server/services/plant/partial-plant-sale.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { return ok({ partialPlantSale: await closePartialPlantSale(await getRequestContext(request), (await params).id) }); } catch (error) { return error instanceof Error && /not found|approved|posted|greater|closed/.test(error.message) ? fail(error.message) : serviceError(error); } }
