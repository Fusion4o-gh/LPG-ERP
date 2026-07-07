import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { globalSearch } from "../../../server/services/search/global-search.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return fail("q must be at least 2 characters.");
    const results = await globalSearch(context, q);
    return ok({ results });
  } catch (error) {
    return serviceError(error);
  }
}
