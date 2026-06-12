import { getRequestContext } from "../../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../../server/api/responses.ts";
import { readJson } from "../../../../../server/api/validation.ts";
import { updateBulkProduct } from "../../../../../server/services/master-data/fleet-master.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const bulkProduct = await updateBulkProduct(context, id, body);
    return ok({ bulkProduct });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
