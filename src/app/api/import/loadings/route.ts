import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createLoading, listLoadings } from "../../../../server/services/import/loadings.ts";

export async function GET(request: Request) { try { const context = await getRequestContext(request); return ok({ loadings: await listLoadings(context, new URL(request.url).searchParams.get("status") || undefined) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { const context = await getRequestContext(request); return ok({ loading: await createLoading(context, await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|negative|greater|exceeds|cancelled/.test(error.message) ? fail(error.message) : serviceError(error); } }
