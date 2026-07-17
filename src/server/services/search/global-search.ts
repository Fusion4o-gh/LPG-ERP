import { PermissionAction } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { purchaseRoutes } from "../../../lib/purchase-routes.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

export type SearchResult = {
  type: string;
  label: string;
  subtitle: string;
  href: string;
};

export async function globalSearch(context: Context, query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "dashboard", PermissionAction.VIEW);
    const results: SearchResult[] = [];

    const customers = await tx.customer.findMany({
      where: {
        companyId: context.companyId,
        OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
      },
      select: { id: true, code: true, name: true },
      take: 5,
    });
    for (const customer of customers) {
      results.push({
        type: "Customer",
        label: `${customer.code} ${customer.name}`,
        subtitle: "Customer master",
        href: `/masters/customers`,
      });
    }

    const vendors = await tx.vendor.findMany({
      where: {
        companyId: context.companyId,
        OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
      },
      select: { id: true, code: true, name: true },
      take: 5,
    });
    for (const vendor of vendors) {
      results.push({
        type: "Vendor",
        label: `${vendor.code} ${vendor.name}`,
        subtitle: "Vendor master",
        href: `/masters/vendors`,
      });
    }

    const vouchers = await tx.accountingVoucher.findMany({
      where: {
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        OR: [{ voucherNo: { contains: q, mode: "insensitive" } }, { sourceId: { contains: q, mode: "insensitive" } }],
      },
      select: { id: true, voucherNo: true, sourceType: true, sourceId: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    for (const voucher of vouchers) {
      results.push({
        type: "Voucher",
        label: voucher.sourceId ?? voucher.voucherNo,
        subtitle: voucher.sourceType ?? "Accounting voucher",
        href: `/accounting/vouchers/${voucher.id}`,
      });
    }

    if (/^\d+$/.test(q)) {
      const sale = await tx.accountingVoucher.findFirst({
        where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "SaleLpg", sourceId: q },
        select: { sourceId: true },
      });
      if (sale?.sourceId) {
        results.unshift({
          type: "Sale LPG",
          label: `Issue #${sale.sourceId}`,
          subtitle: "Sale LPG invoice",
          href: `/operations/sale-lpg/print/${encodeURIComponent(sale.sourceId)}`,
        });
      }

      const purchase = await tx.accountingVoucher.findFirst({
        where: { companyId: context.companyId, financialYearId: context.financialYearId, sourceType: "PurchaseFilledCylinder", sourceId: q },
        select: { sourceId: true },
      });
      if (purchase?.sourceId) {
        results.unshift({
          type: "Purchase",
          label: `Receipt #${purchase.sourceId}`,
          subtitle: "Purchase filled cylinder",
          href: purchaseRoutes.filled.print(purchase.sourceId),
        });
      }
    }

    return results.slice(0, limit);
  });
}
