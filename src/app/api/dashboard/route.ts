import { ok, serviceError } from "../../../server/api/responses.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { getDashboardData } from "../../../server/services/dashboard/dashboard.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const data = await getDashboardData(context);
    return ok(data);
  } catch (error) {
    return serviceError(error);
  }
}
