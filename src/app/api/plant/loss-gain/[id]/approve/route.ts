import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../../../server/api/responses.ts";
import { approveLossGain } from "../../../../../../server/services/plant/loss-gain.ts";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { return ok({ lossGain: await approveLossGain(await getRequestContext(_request), (await params).id) }); } catch (error) { return serviceError(error); } }
