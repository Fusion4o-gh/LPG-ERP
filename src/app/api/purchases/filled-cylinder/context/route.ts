import { getPurchaseFilledContext } from "../../../../../server/services/purchases/purchase-context.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const vendorId = url.searchParams.get("vendorId") ?? undefined;
    const itemIds = url.searchParams.getAll("itemId").filter(Boolean);
    const data = await getPurchaseFilledContext(context, { vendorId, itemIds });
    return ok(data);
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
