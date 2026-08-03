import { getRequestContext } from "../../../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../../../server/api/responses.ts";
import { lockOpeningBalances } from "../../../../../../server/services/company/financial-years.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const { id } = await params;
    return ok({ financialYear: await lockOpeningBalances(context, id) });
  } catch (error) {
    return serviceError(error);
  }
}
