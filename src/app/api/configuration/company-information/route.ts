import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { getCompanyInformation, updateCompanyInformation } from "../../../../server/services/company/company-information.ts";

function optionalWorkingDays(body: Record<string, unknown>) {
  const value = body.workingDays;
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("workingDays must be an object.");
  return value as Record<string, boolean>;
}

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const company = await getCompanyInformation(context);
    return ok({ company });
  } catch (error) {
    return serviceError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const company = await updateCompanyInformation(context, {
      legalName: stringField(body, "legalName"),
      tradeName: optionalStringField(body, "tradeName"),
      ownerName: optionalStringField(body, "ownerName"),
      address: optionalStringField(body, "address"),
      phone: optionalStringField(body, "phone"),
      email: optionalStringField(body, "email"),
      taxRegistrationNumber: optionalStringField(body, "taxRegistrationNumber"),
      nationalTaxNumber: optionalStringField(body, "nationalTaxNumber"),
      workingDays: optionalWorkingDays(body),
    });
    return ok({ company });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
