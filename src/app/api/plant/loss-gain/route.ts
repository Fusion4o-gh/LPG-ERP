import { getRequestContext } from "../../../../server/api/request-context.ts";
import { booleanField, dateField, optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { createLossGain, listLossGains } from "../../../../server/services/plant/loss-gain.ts";

export async function GET(request: Request) { try { const context = await getRequestContext(request); const p = new URL(request.url).searchParams; return ok({ lossGains: await listLossGains(context, { from: p.get("from") ?? undefined, to: p.get("to") ?? undefined, status: p.get("status") ?? undefined }) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { const context = await getRequestContext(request); const body = await readJson(request); return ok({ lossGain: await createLossGain(context, { type: stringField(body, "type"), productId: stringField(body, "productId"), locationId: stringField(body, "locationId"), quantity: body.quantity as string | number, rate: body.rate as string | number, transactionDate: dateField(body, "transactionDate"), remarks: optionalStringField(body, "remarks"), allowClosedDayOverride: booleanField(body, "allowClosedDayOverride") }) }); } catch (error) { return serviceError(error); } }
