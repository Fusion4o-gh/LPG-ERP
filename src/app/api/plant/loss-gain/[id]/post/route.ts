import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { booleanField, readJson } from "../../../../../../server/api/validation.ts";
import { ok, serviceError } from "../../../../../../server/api/responses.ts";
import { postLossGainToPl } from "../../../../../../server/services/plant/loss-gain.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const body = await readJson(request); return ok({ lossGain: await postLossGainToPl(await getRequestContext(request), (await params).id, booleanField(body, "allowClosedDayOverride")) }); } catch (error) { return serviceError(error); } }
