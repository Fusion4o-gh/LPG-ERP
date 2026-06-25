import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { dateField, optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../../../../server/services/accounting/document-numbers.ts";
import { createPhysicalCount, listPhysicalCounts } from "../../../../server/services/warehouse/physical-count.ts";
import { CountStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const locationId = url.searchParams.get("locationId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;

    const counts = await prisma.$transaction((tx) =>
      listPhysicalCounts(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        locationId,
        status: status as CountStatus | undefined,
        from,
        to,
        limit,
      }),
    );

    return ok({ counts });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);

    const result = await prisma.$transaction(async (tx) => {
      const documentNo = await nextDocumentNumberInTransaction(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        prefix: DOCUMENT_PREFIXES.physicalCount,
      });

      const count = await createPhysicalCount(tx, {
        ...context,
        documentNo,
        locationId: stringField(body, "locationId"),
        countDate: dateField(body, "countDate"),
        notes: optionalStringField(body, "notes"),
      });

      return { documentNo, count };
    });

    return ok({
      documentNo: result.documentNo,
      count: result.count,
    });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
