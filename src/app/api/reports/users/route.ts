import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getReportUsers } from "../../../../server/services/reports/accounting-reports.ts";
export async function GET(request: Request) { try { return ok({ users: await getReportUsers(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
