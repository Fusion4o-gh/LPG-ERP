import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { updateBank } from "../../../../server/services/master-data/master-data.ts";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const { id } = await params;
    const bank = await updateBank(context, id, {
      name: stringField(body, "name"),
      accountNumber: optionalStringField(body, "accountNumber"),
      phone: optionalStringField(body, "phone"),
      address: optionalStringField(body, "address"),
      email: optionalStringField(body, "email"),
      openingBalance: optionalStringField(body, "openingBalance"),
      openingBalanceType: optionalStringField(body, "openingBalanceType"),
      status: optionalStringField(body, "status") as never,
    });
    return ok({ bank });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}

