import { AuditAction, LocationType, PermissionAction, Prisma, RecordStatus, UnitOfMeasure, VehicleStatus } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = Prisma.TransactionClient;
type Context = { companyId: string; financialYearId: string; userId: string };

type FleetInput = {
  code?: string;
  name?: string;
  contactPerson?: string;
  phone?: string;
  address?: string;
  ntn?: string;
  transporterId?: string;
  driverId?: string;
  cell?: string;
  cnic?: string;
  licenseNo?: string;
  registrationNo?: string;
  bowserCapacity?: string | number;
  capacityUnit?: string;
  cityId?: string;
  location?: string;
  plantId?: string;
  type?: string;
  unit?: string;
  status?: string;
};

function str(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requiredName(value?: string) {
  if (!value?.trim()) throw new Error("name is required.");
  return value.trim();
}

function requiredCode(value?: string) {
  if (!value?.trim()) throw new Error("code is required.");
  return value.trim().toUpperCase();
}

function status(value?: string) {
  return value === "INACTIVE" ? RecordStatus.INACTIVE : RecordStatus.ACTIVE;
}

function unit(value?: string) {
  return value && (Object.values(UnitOfMeasure) as string[]).includes(value) ? (value as UnitOfMeasure) : UnitOfMeasure.MT;
}

function decimalOrNull(value?: string | number) {
  if (value === undefined || value === null || value === "") return null;
  const amount = new Prisma.Decimal(value);
  if (amount.isNegative()) throw new Error("bowserCapacity cannot be negative.");
  return amount;
}

async function ensureCode(tx: Tx, model: "transporter" | "plant" | "stockLocation" | "bulkProduct", companyId: string, code: string, id?: string) {
  const where = { companyId, code, ...(id ? { NOT: { id } } : {}) };
  const existing =
    model === "transporter"
      ? await tx.transporter.findFirst({ where, select: { id: true } })
      : model === "plant"
        ? await tx.plant.findFirst({ where, select: { id: true } })
        : model === "stockLocation"
          ? await tx.stockLocation.findFirst({ where, select: { id: true } })
          : await tx.bulkProduct.findFirst({ where, select: { id: true } });
  if (existing) throw new Error("code already exists.");
}

// ---------------------------------------------------------------- Transporter
export async function listTransporters(context: Context, includeAll = false) {
  return prisma.transporter.findMany({
    where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, contactPerson: true, phone: true, address: true, ntn: true, status: true },
    take: 500,
  });
}

export async function createTransporter(context: Context, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "transporters", PermissionAction.CREATE);
    const code = requiredCode(input.code);
    await ensureCode(tx, "transporter", context.companyId, code);
    const row = await tx.transporter.create({
      data: {
        companyId: context.companyId,
        code,
        name: requiredName(input.name),
        contactPerson: str(input.contactPerson),
        phone: str(input.phone),
        address: str(input.address),
        ntn: str(input.ntn),
        status: status(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Transporter", entityId: row.id, after: row });
    return row;
  });
}

export async function updateTransporter(context: Context, id: string, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "transporters", PermissionAction.UPDATE);
    const before = await tx.transporter.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const code = requiredCode(input.code);
    await ensureCode(tx, "transporter", context.companyId, code, id);
    const row = await tx.transporter.update({
      where: { id },
      data: {
        code,
        name: requiredName(input.name),
        contactPerson: str(input.contactPerson),
        phone: str(input.phone),
        address: str(input.address),
        ntn: str(input.ntn),
        status: status(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Transporter", entityId: id, before, after: row });
    return row;
  });
}

// --------------------------------------------------------------------- Driver
export async function listDrivers(context: Context, includeAll = false) {
  const rows = await prisma.driver.findMany({
    where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { id: true, name: true, cell: true, cnic: true, licenseNo: true, transporterId: true, status: true, transporter: { select: { name: true } } },
    take: 500,
  });
  return rows.map((r) => ({ ...r, transporterName: r.transporter?.name ?? "" }));
}

export async function createDriver(context: Context, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "drivers", PermissionAction.CREATE);
    const row = await tx.driver.create({
      data: {
        companyId: context.companyId,
        name: requiredName(input.name),
        cell: str(input.cell),
        cnic: str(input.cnic),
        licenseNo: str(input.licenseNo),
        transporterId: str(input.transporterId),
        status: status(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Driver", entityId: row.id, after: row });
    return row;
  });
}

export async function updateDriver(context: Context, id: string, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "drivers", PermissionAction.UPDATE);
    const before = await tx.driver.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const row = await tx.driver.update({
      where: { id },
      data: {
        name: requiredName(input.name),
        cell: str(input.cell),
        cnic: str(input.cnic),
        licenseNo: str(input.licenseNo),
        transporterId: str(input.transporterId),
        status: status(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Driver", entityId: id, before, after: row });
    return row;
  });
}

// -------------------------------------------------------------------- Vehicle
function vehicleStatus(value?: string) {
  return value && (Object.values(VehicleStatus) as string[]).includes(value) ? (value as VehicleStatus) : VehicleStatus.ACTIVE;
}

export async function listVehicles(context: Context, includeAll = false) {
  const rows = await prisma.vehicle.findMany({
    where: { companyId: context.companyId, status: includeAll ? undefined : VehicleStatus.ACTIVE },
    orderBy: { registrationNo: "asc" },
    select: {
      id: true,
      registrationNo: true,
      bowserCapacity: true,
      capacityUnit: true,
      transporterId: true,
      driverId: true,
      status: true,
      transporter: { select: { name: true } },
      driver: { select: { name: true } },
    },
    take: 500,
  });
  return rows.map((r) => ({
    ...r,
    bowserCapacity: r.bowserCapacity ? r.bowserCapacity.toString() : "",
    transporterName: r.transporter?.name ?? "",
    driverName: r.driver?.name ?? "",
  }));
}

export async function createVehicle(context: Context, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vehicles", PermissionAction.CREATE);
    const registrationNo = requiredName(input.registrationNo).toUpperCase();
    const dup = await tx.vehicle.findFirst({ where: { companyId: context.companyId, registrationNo }, select: { id: true } });
    if (dup) throw new Error("registrationNo already exists.");
    const row = await tx.vehicle.create({
      data: {
        companyId: context.companyId,
        registrationNo,
        bowserCapacity: decimalOrNull(input.bowserCapacity),
        capacityUnit: unit(input.capacityUnit),
        transporterId: str(input.transporterId),
        driverId: str(input.driverId),
        status: vehicleStatus(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Vehicle", entityId: row.id, after: row });
    return row;
  });
}

export async function updateVehicle(context: Context, id: string, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "vehicles", PermissionAction.UPDATE);
    const before = await tx.vehicle.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const registrationNo = requiredName(input.registrationNo).toUpperCase();
    const dup = await tx.vehicle.findFirst({ where: { companyId: context.companyId, registrationNo, NOT: { id } }, select: { id: true } });
    if (dup) throw new Error("registrationNo already exists.");
    const row = await tx.vehicle.update({
      where: { id },
      data: {
        registrationNo,
        bowserCapacity: decimalOrNull(input.bowserCapacity),
        capacityUnit: unit(input.capacityUnit),
        transporterId: str(input.transporterId),
        driverId: str(input.driverId),
        status: vehicleStatus(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Vehicle", entityId: id, before, after: row });
    return row;
  });
}

// ---------------------------------------------------------------------- Plant
export async function listPlants(context: Context, includeAll = false) {
  const rows = await prisma.plant.findMany({
    where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, cityId: true, location: true, status: true },
    take: 500,
  });
  const cityIds = [...new Set(rows.map((r) => r.cityId).filter((v): v is string => Boolean(v)))];
  const cities = cityIds.length
    ? await prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, name: true } })
    : [];
  const cityById = new Map(cities.map((c) => [c.id, c.name]));
  return rows.map((r) => ({ ...r, cityName: r.cityId ? cityById.get(r.cityId) ?? "" : "" }));
}

export async function createPlant(context: Context, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "plants", PermissionAction.CREATE);
    const code = requiredCode(input.code);
    await ensureCode(tx, "plant", context.companyId, code);
    const row = await tx.plant.create({
      data: {
        companyId: context.companyId,
        code,
        name: requiredName(input.name),
        cityId: str(input.cityId),
        location: str(input.location),
        status: status(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "Plant", entityId: row.id, after: row });
    return row;
  });
}

export async function updatePlant(context: Context, id: string, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "plants", PermissionAction.UPDATE);
    const before = await tx.plant.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const code = requiredCode(input.code);
    await ensureCode(tx, "plant", context.companyId, code, id);
    const row = await tx.plant.update({
      where: { id },
      data: { code, name: requiredName(input.name), cityId: str(input.cityId), location: str(input.location), status: status(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "Plant", entityId: id, before, after: row });
    return row;
  });
}

// -------------------------------------------------------------- StockLocation
function locationType(value?: string) {
  return value && (Object.values(LocationType) as string[]).includes(value) ? (value as LocationType) : LocationType.PLANT;
}

export async function listStockLocations(context: Context, includeAll = false) {
  const rows = await prisma.stockLocation.findMany({
    where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, type: true, plantId: true, status: true, plant: { select: { name: true } } },
    take: 500,
  });
  return rows.map((r) => ({ ...r, plantName: r.plant?.name ?? "" }));
}

export async function createStockLocation(context: Context, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "stock-locations", PermissionAction.CREATE);
    const code = requiredCode(input.code);
    await ensureCode(tx, "stockLocation", context.companyId, code);
    const row = await tx.stockLocation.create({
      data: {
        companyId: context.companyId,
        code,
        name: requiredName(input.name),
        type: locationType(input.type),
        plantId: str(input.plantId),
        status: status(input.status),
      },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "StockLocation", entityId: row.id, after: row });
    return row;
  });
}

export async function updateStockLocation(context: Context, id: string, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "stock-locations", PermissionAction.UPDATE);
    const before = await tx.stockLocation.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const code = requiredCode(input.code);
    await ensureCode(tx, "stockLocation", context.companyId, code, id);
    const row = await tx.stockLocation.update({
      where: { id },
      data: { code, name: requiredName(input.name), type: locationType(input.type), plantId: str(input.plantId), status: status(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "StockLocation", entityId: id, before, after: row });
    return row;
  });
}

// ---------------------------------------------------------------- BulkProduct
export async function listBulkProducts(context: Context, includeAll = false) {
  return prisma.bulkProduct.findMany({
    where: { companyId: context.companyId, status: includeAll ? undefined : RecordStatus.ACTIVE },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, unit: true, status: true },
    take: 500,
  });
}

export async function createBulkProduct(context: Context, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "bulk-products", PermissionAction.CREATE);
    const code = requiredCode(input.code);
    await ensureCode(tx, "bulkProduct", context.companyId, code);
    const row = await tx.bulkProduct.create({
      data: { companyId: context.companyId, code, name: requiredName(input.name), unit: unit(input.unit), status: status(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, entityType: "BulkProduct", entityId: row.id, after: row });
    return row;
  });
}

export async function updateBulkProduct(context: Context, id: string, input: FleetInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "bulk-products", PermissionAction.UPDATE);
    const before = await tx.bulkProduct.findFirstOrThrow({ where: { id, companyId: context.companyId } });
    const code = requiredCode(input.code);
    await ensureCode(tx, "bulkProduct", context.companyId, code, id);
    const row = await tx.bulkProduct.update({
      where: { id },
      data: { code, name: requiredName(input.name), unit: unit(input.unit), status: status(input.status) },
    });
    await writeAuditLog(tx, { companyId: context.companyId, userId: context.userId, action: AuditAction.UPDATE, entityType: "BulkProduct", entityId: id, before, after: row });
    return row;
  });
}
