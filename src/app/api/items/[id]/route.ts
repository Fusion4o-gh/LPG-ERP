import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalPositiveNumberField, optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { updateItem } from "../../../../server/services/master-data/master-data.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const item = await updateItem(context, id, {
      code: stringField(body, "code"),
      name: stringField(body, "name"),
      cylinderWeightKg: optionalPositiveNumberField(body, "cylinderWeightKg"),
      defaultSecurity: optionalPositiveNumberField(body, "defaultSecurity"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ item });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}

