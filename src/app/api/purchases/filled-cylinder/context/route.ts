import { getPurchaseFilledContext } from "../../../../../server/services/purchases/purchase-context.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const vendorId = new URL(request.url).searchParams.get("vendorId") ?? undefined;
    const data = await getPurchaseFilledContext(context, { vendorId });
    return ok(data);
  } catch (error) {
    return serviceError(error);
  }
}
