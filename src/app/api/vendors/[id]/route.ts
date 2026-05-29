import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { mapMasterRow, vendorBody } from "../../../../server/api/master-body.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { updateVendor } from "../../../../server/services/master-data/master-data.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const vendor = await updateVendor(context, id, vendorBody(body));
    return ok({ vendor: mapMasterRow(vendor) });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
