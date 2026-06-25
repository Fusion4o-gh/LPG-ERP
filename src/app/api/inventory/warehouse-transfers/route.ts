import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import { arrayField, dateField, optionalStringField, readJson, stringField } from "../../../../server/api/validation.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction } from "../../../../server/services/accounting/document-numbers.ts";
import { createWarehouseTransfer, listWarehouseTransfers } from "../../../../server/services/warehouse/warehouse-transfer.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined;

    const transfers = await prisma.$transaction((tx) =>
      listWarehouseTransfers(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        from,
        to,
        status: status as never,
        limit,
      }),
    );

    return ok({ transfers });
  } catch (error) {
    return serviceError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestContext(request);
    const body = await readJson(request);

    const lines = arrayField(body, "lines").map((line) => ({
      itemId: stringField(line, "itemId"),
      cylinderState: stringField(line, "cylinderState") as "FILLED" | "EMPTY",
      quantity: Number(line.quantity),
      remarks: optionalStringField(line, "remarks"),
    }));

    const result = await prisma.$transaction(async (tx) => {
      const documentNo = await nextDocumentNumberInTransaction(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        prefix: DOCUMENT_PREFIXES.warehouseTransfer,
      });

      const { transfer, stockEntries } = await createWarehouseTransfer(tx, {
        ...context,
        documentNo,
        transferDate: dateField(body, "transferDate"),
        sourceLocationId: stringField(body, "sourceLocationId"),
        destinationLocationId: stringField(body, "destinationLocationId"),
        lines,
      });

      return { transfer, documentNo, stockEntryCount: stockEntries.length };
    });

    return ok({
      documentNo: result.documentNo,
      transfer: result.transfer,
      stockEntryCount: result.stockEntryCount,
    });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
