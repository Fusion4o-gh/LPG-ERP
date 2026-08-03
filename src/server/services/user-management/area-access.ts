import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

async function assignedAreaIds(tx: Tx, userId: string) {
  const areaIds = (
    await tx.userArea.findMany({
      where: { userId },
      select: { areaId: true },
    })
  ).map((row) => row.areaId);

  return areaIds;
}

/** When a user has map-area assignments, restrict customer lookups to those areas. */
export async function customerAreaFilter(tx: Tx, userId: string): Promise<Prisma.CustomerWhereInput | undefined> {
  const areaIds = await assignedAreaIds(tx, userId);
  return areaIds.length === 0 ? undefined : { areaId: { in: areaIds } };
}

/** Vendor counterpart of customerAreaFilter; no assignments means unrestricted access. */
export async function vendorAreaFilter(tx: Tx, userId: string): Promise<Prisma.VendorWhereInput | undefined> {
  const areaIds = await assignedAreaIds(tx, userId);
  return areaIds.length === 0 ? undefined : { areaId: { in: areaIds } };
}

export async function assertCustomerAreaAccess(tx: Tx, userId: string, companyId: string, customerId: string) {
  const filter = await customerAreaFilter(tx, userId);
  const customer = await tx.customer.findFirst({ where: { id: customerId, companyId, ...(filter ?? {}) }, select: { id: true } });
  if (!customer) throw new Error("customerId is invalid or customer is not accessible for this user.");
}

export async function assertVendorAreaAccess(tx: Tx, userId: string, companyId: string, vendorId: string) {
  const filter = await vendorAreaFilter(tx, userId);
  const vendor = await tx.vendor.findFirst({ where: { id: vendorId, companyId, ...(filter ?? {}) }, select: { id: true } });
  if (!vendor) throw new Error("vendorId is invalid or vendor is not accessible for this user.");
}
