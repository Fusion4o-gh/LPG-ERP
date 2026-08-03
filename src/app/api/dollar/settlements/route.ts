import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createDollarSettlement, listDollarTransactions } from "../../../../server/services/dollar/dollar-transactions.ts";
export async function GET(request: Request) { try { return ok({ dollarSettlements: await listDollarTransactions(await getRequestContext(request), "PAYMENT") }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ dollarSettlement: await createDollarSettlement(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|positive|must be/.test(error.message) ? fail(error.message) : serviceError(error); } }
