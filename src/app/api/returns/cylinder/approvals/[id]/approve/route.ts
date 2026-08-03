import { getRequestContext } from "../../../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../../../server/api/responses.ts";
import { approveValuedCylinderReturn } from "../../../../../../../server/services/returns/cylinder-return.ts";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { try { return ok(await approveValuedCylinderReturn(await getRequestContext(request), (await params).id)); } catch (error) { return error instanceof Error && /not found|pending|approved|required|owed|invalid|exceed/.test(error.message) ? fail(error.message) : serviceError(error); } }
