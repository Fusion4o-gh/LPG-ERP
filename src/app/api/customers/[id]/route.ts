import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { customerBody, mapMasterRow } from "../../../../server/api/master-body.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { updateCustomer } from "../../../../server/services/master-data/master-data.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const customer = await updateCustomer(context, id, customerBody(body));
    return ok({ customer: mapMasterRow(customer) });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
