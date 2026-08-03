import { ok, serviceError } from "../../../server/api/responses.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { getDashboardData } from "../../../server/services/dashboard/dashboard.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const params = new URL(request.url).searchParams;
    const month = Number(params.get("month"));
    const year = Number(params.get("year"));
    const data = await getDashboardData(context, {
      month: Number.isFinite(month) ? month : undefined,
      year: Number.isFinite(year) ? year : undefined,
    });
    return ok(data);
  } catch (error) {
    return serviceError(error);
  }
}
