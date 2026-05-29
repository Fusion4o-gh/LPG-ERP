import { prisma } from "../../../lib/prisma.ts";
import { getRequestContext } from "../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../server/api/responses.ts";
import { mapMasterRow, vendorBody, vendorListSelect } from "../../../server/api/master-body.ts";
import { createVendor } from "../../../server/services/master-data/master-data.ts";
import { readJson } from "../../../server/api/validation.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const includeAll = new URL(request.url).searchParams.get("all") === "1";
    const vendors = await prisma.vendor.findMany({
      where: { companyId: context.companyId, status: includeAll ? undefined : "ACTIVE" },
      orderBy: { name: "asc" },
      select: vendorListSelect,
      take: 500,
    });
    return ok({ vendors: vendors.map(mapMasterRow) });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);
    const vendor = await createVendor(context, vendorBody(body));
    return ok({ vendor: mapMasterRow(vendor) });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
