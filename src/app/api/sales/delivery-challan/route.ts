import { DeliveryChallanStatus, PermissionAction } from "@prisma/client";
import { prisma } from "../../../../lib/prisma.ts";
import { getRequestContext } from "../../../../server/api/request-context.ts";
import { fail, ok, serviceError } from "../../../../server/api/responses.ts";
import {
  arrayField,
  booleanField,
  dateField,
  optionalStringField,
  positiveIntegerField,
  readJson,
  stringField,
} from "../../../../server/api/validation.ts";
import { DOCUMENT_PREFIXES, nextDocumentNumberInTransaction, peekNextDocumentNumber } from "../../../../server/services/accounting/document-numbers.ts";
import { enforcePermission } from "../../../../server/services/rbac/enforce.ts";
import {
  createDeliveryChallan,
  listDeliveryChallansForUser,
  listOpenDeliveryChallansForCustomer,
} from "../../../../server/services/sales/delivery-challan.ts";

export async function GET(request: Request) {
  try {
    const context = await getRequestContext(request);
    const url = new URL(request.url);
    const openForCustomer = url.searchParams.get("openForCustomer");
    if (openForCustomer) {
      await prisma.$transaction(async (tx) => {
        try {
          await enforcePermission(tx, context.userId, "delivery-challan", PermissionAction.VIEW);
        } catch {
          await enforcePermission(tx, context.userId, "sale-lpg", PermissionAction.VIEW);
        }
      });
      const challans = await prisma.$transaction((tx) =>
        listOpenDeliveryChallansForCustomer(tx, context.companyId, context.financialYearId, openForCustomer),
      );
      return ok({ challans });
    }

    if (url.searchParams.get("preview") === "1") {
      await prisma.$transaction((tx) => enforcePermission(tx, context.userId, "delivery-challan", PermissionAction.VIEW));
      const documentNo = await peekNextDocumentNumber({
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        prefix: DOCUMENT_PREFIXES.deliveryChallan,
      });
      return ok({ documentNo });
    }

    const result = await prisma.$transaction((tx) =>
      listDeliveryChallansForUser(tx, context.userId, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
        status: (url.searchParams.get("status") as DeliveryChallanStatus | null) ?? undefined,
        customerId: url.searchParams.get("customerId") ?? undefined,
        limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
        offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
        search: url.searchParams.get("search") ?? undefined,
      }),
    );
    return ok(result);
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
      quantity: positiveIntegerField(line, "quantity"),
      remarks: optionalStringField(line, "remarks"),
    }));

    const result = await prisma.$transaction(async (tx) => {
      const documentNo = await nextDocumentNumberInTransaction(tx, {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        prefix: DOCUMENT_PREFIXES.deliveryChallan,
      });
      const { challan, stockEntries } = await createDeliveryChallan(tx, {
        ...context,
        documentNo,
        challanDate: dateField(body, "challanDate"),
        customerId: stringField(body, "customerId"),
        locationId: optionalStringField(body, "locationId"),
        transporterId: optionalStringField(body, "transporterId"),
        vehicleId: optionalStringField(body, "vehicleId"),
        driverId: optionalStringField(body, "driverId"),
        remarks: optionalStringField(body, "remarks"),
        allowClosedDayOverride: booleanField(body, "allowClosedDayOverride"),
        lines,
      });
      return { challan, documentNo, stockEntryCount: stockEntries.length };
    });

    return ok({
      documentNo: result.documentNo,
      challan: result.challan,
      stockEntryCount: result.stockEntryCount,
    });
  } catch (error) {
    return error instanceof Error && error.message.includes("required") ? fail(error.message) : serviceError(error);
  }
}
