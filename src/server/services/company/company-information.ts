import { AuditAction, PermissionAction, type Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";
import { writeAuditLog } from "../audit/audit-log.ts";
import { enforcePermission } from "../rbac/enforce.ts";

type Context = { companyId: string; financialYearId: string; userId: string };

export type CompanyInformationInput = {
  legalName: string;
  tradeName?: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxRegistrationNumber?: string;
  nationalTaxNumber?: string;
  logoUrl?: string | null;
  stockAvailableCheck?: boolean;
  centralizedPricing?: boolean;
  showDefaultDate?: boolean;
  redirectOnSamePage?: boolean;
  workStartTime?: string;
  workEndTime?: string;
  workingDays?: Record<string, boolean>;
  standardPurchaseCylinderKg?: number | string;
};

const workingDayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function requiredString(value: string | undefined, field: string) {
  if (!value?.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}

function optionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanEmail(value: string | undefined) {
  const email = optionalString(value);
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("email must be valid.");
  return email;
}

function positiveDecimal(value: number | string, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} must be a positive number.`);
  return parsed;
}

function cleanWorkingDays(value: CompanyInformationInput["workingDays"]): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("workingDays must be an object.");
  return Object.fromEntries(workingDayKeys.map((day) => [day, value[day] === true]));
}

const companySelect = {
  id: true,
  legalName: true,
  tradeName: true,
  ownerName: true,
  address: true,
  phone: true,
  email: true,
  taxRegistrationNumber: true,
  nationalTaxNumber: true,
  logoUrl: true,
  baseCurrency: true,
  locale: true,
  timeZone: true,
  workingDays: true,
  stockAvailableCheck: true,
  centralizedPricing: true,
  showDefaultDate: true,
  redirectOnSamePage: true,
  workStartTime: true,
  workEndTime: true,
  standardPurchaseCylinderKg: true,
  status: true,
} satisfies Prisma.CompanySelect;

export async function getCompanyInformation(context: Context) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "company", PermissionAction.VIEW);
    return tx.company.findUniqueOrThrow({ where: { id: context.companyId }, select: companySelect });
  });
}

export async function updateCompanyInformation(context: Context, input: CompanyInformationInput) {
  return prisma.$transaction(async (tx) => {
    await enforcePermission(tx, context.userId, "company", PermissionAction.UPDATE);
    const before = await tx.company.findUniqueOrThrow({ where: { id: context.companyId }, select: companySelect });
    const workingDays = cleanWorkingDays(input.workingDays);
    const company = await tx.company.update({
      where: { id: context.companyId },
      data: {
        legalName: requiredString(input.legalName, "legalName"),
        tradeName: optionalString(input.tradeName),
        ownerName: optionalString(input.ownerName),
        address: optionalString(input.address),
        phone: optionalString(input.phone),
        email: cleanEmail(input.email),
        taxRegistrationNumber: optionalString(input.taxRegistrationNumber),
        nationalTaxNumber: optionalString(input.nationalTaxNumber),
        ...(input.stockAvailableCheck === undefined ? {} : { stockAvailableCheck: input.stockAvailableCheck }),
        ...(input.centralizedPricing === undefined ? {} : { centralizedPricing: input.centralizedPricing }),
        ...(input.showDefaultDate === undefined ? {} : { showDefaultDate: input.showDefaultDate }),
        ...(input.redirectOnSamePage === undefined ? {} : { redirectOnSamePage: input.redirectOnSamePage }),
        ...(input.workStartTime === undefined ? {} : { workStartTime: optionalString(input.workStartTime) }),
        ...(input.workEndTime === undefined ? {} : { workEndTime: optionalString(input.workEndTime) }),
        ...(workingDays === undefined ? {} : { workingDays }),
        ...(input.standardPurchaseCylinderKg === undefined
          ? {}
          : { standardPurchaseCylinderKg: positiveDecimal(input.standardPurchaseCylinderKg, "standardPurchaseCylinderKg") }),
      },
      select: companySelect,
    });
    await writeAuditLog(tx, {
      companyId: context.companyId,
      userId: context.userId,
      action: AuditAction.UPDATE,
      entityType: "Company",
      entityId: context.companyId,
      before,
      after: company,
    });
    return company;
  });
}
