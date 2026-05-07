import { getSessionContextFromRequest } from "../auth/session.ts";

export type RequestContext = {
  companyId: string;
  financialYearId: string;
  userId: string;
};

function header(request: Request | undefined, name: string) {
  return request?.headers.get(name) ?? undefined;
}

export async function getRequestContext(request?: Request): Promise<RequestContext> {
  if (!request) {
    throw new Error("Authentication required.");
  }

  const headerContext = header(request, "x-company-id") && header(request, "x-financial-year-id") && header(request, "x-user-id");
  if (headerContext && process.env.NODE_ENV === "test") {
    return {
      companyId: header(request, "x-company-id") as string,
      financialYearId: header(request, "x-financial-year-id") as string,
      userId: header(request, "x-user-id") as string,
    };
  }

  const context = await getSessionContextFromRequest(request);
  if (!context) {
    throw new Error("Authentication required.");
  }
  return context;
}
