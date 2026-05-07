import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { updateCustomer } from "../../../../server/services/master-data/master-data.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const customer = await updateCustomer(context, id, {
      code: stringField(body, "code"),
      name: stringField(body, "name"),
      phone: optionalStringField(body, "phone"),
      cell: optionalStringField(body, "cell"),
      address: optionalStringField(body, "address"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ customer });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}

