import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { readJson } from "../../../../server/api/validation.ts";
import { createSaleContract, listSaleContracts } from "../../../../server/services/import/sale-contracts.ts";
export async function GET(request: Request) { try { return ok({ saleContracts: await listSaleContracts(await getRequestContext(request)) }); } catch (error) { return serviceError(error); } }
export async function POST(request: Request) { try { return ok({ saleContract: await createSaleContract(await getRequestContext(request), await readJson(request)) }); } catch (error) { return error instanceof Error && /required|invalid|negative|greater/.test(error.message) ? fail(error.message) : serviceError(error); } }
