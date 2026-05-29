import { getSaleLpgContext } from "../../../../../server/services/sales/sale-context.ts";
import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const customerId = url.searchParams.get("customerId") ?? undefined;
    const itemIds = url.searchParams.getAll("itemId").filter(Boolean);
    const data = await getSaleLpgContext(context, { customerId, itemIds });
    return ok(data);
  } catch (error) {
    return error instanceof Error ? error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
