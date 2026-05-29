import { getRequestContext } from "../../../../server/api/request-context.ts";
import { ok, serviceError } from "../../../../server/api/responses.ts";
import { getSettlementBalancePreview } from "../../../../server/services/accounting/account-balances.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const bankId = new URL(request.url).searchParams.get("bankId") ?? undefined;
    const balances = await getSettlementBalancePreview(context, { bankId });
    return ok(balances);
  } catch (error) {
    return serviceError(error);
  }
}
