import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../../server/api/responses.ts";
import { readJson } from "../../../../../../server/api/validation.ts";
import { receivePartial } from "../../../../../../server/services/plant/partial-receiving.ts";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { return ok({ partialReceiving: await receivePartial(await getRequestContext(request), (await params).id, await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|non-negative|greater|exceed|complete/.test(error.message) ? fail(error.message) : serviceError(error); } }
