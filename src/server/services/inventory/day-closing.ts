import { PermissionAction, type Prisma } from "@prisma/client";
import { enforcePermission } from "../rbac/enforce.ts";

type Tx = Prisma.TransactionClient;

type GuardInput = {
  companyId: string;
  financialYearId: string;
  userId: string;
  transactionDate: string | Date;
  allowClosedDayOverride?: boolean;
};

const workingDayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function dateOnly(value: string | Date) {
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(value: string | Date) {
  return dateOnly(value).toISOString().slice(0, 10);
}

function clockMinutes(value: string | null | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return undefined;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function localNow(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      minutes: Number(values.hour) * 60 + Number(values.minute),
    };
  } catch {
    return undefined;
  }
}

async function assertCompanySchedule(tx: Tx, input: GuardInput) {
  const company = await tx.company.findUnique({
    where: { id: input.companyId },
    select: { workingDays: true, workStartTime: true, workEndTime: true, timeZone: true },
  });
  if (!company) return;

  const transactionDate = dateOnly(input.transactionDate);
  const dayKey = workingDayKeys[transactionDate.getUTCDay()];
  if (company.workingDays && typeof company.workingDays === "object" && !Array.isArray(company.workingDays)) {
    const workingDays = company.workingDays as Record<string, unknown>;
    if (workingDays[dayKey] === false) {
      throw new Error(`Transactions are not allowed on ${dayKey}.`);
    }
  }

  const start = clockMinutes(company.workStartTime);
  const end = clockMinutes(company.workEndTime);
  if (start === undefined || end === undefined) return;

  const now = localNow(company.timeZone || "UTC");
  if (!now || now.date !== dateKey(input.transactionDate)) return;

  const withinHours = start <= end ? now.minutes >= start && now.minutes <= end : now.minutes >= start || now.minutes <= end;
  if (!withinHours) {
    throw new Error(`Transactions are only allowed between ${company.workStartTime} and ${company.workEndTime}.`);
  }
}

export type DayClosingTrailStatus = "closed" | "reopen_requested" | "reopened" | "reclosed";

const trailStatuses = new Set<DayClosingTrailStatus>(["closed", "reopen_requested", "reopened", "reclosed"]);

function trailStatusFromAuditValue(value: unknown): DayClosingTrailStatus | undefined {
  if (!value || typeof value !== "object") return undefined;
  const status = (value as { status?: unknown }).status;
  return typeof status === "string" && trailStatuses.has(status as DayClosingTrailStatus)
    ? (status as DayClosingTrailStatus)
    : undefined;
}

export async function getDayClosingTrailStatus(tx: Tx, closingId: string): Promise<DayClosingTrailStatus> {
  const trail = await tx.auditLog.findMany({
    where: { entityType: "DayClosing", entityId: closingId },
    orderBy: { createdAt: "desc" },
    select: { after: true },
    take: 25,
  });

  for (const entry of trail) {
    const status = trailStatusFromAuditValue(entry.after);
    if (status) return status;
  }

  return "closed";
}

export async function assertWritableBusinessDate(tx: Tx, input: GuardInput) {
  await assertCompanySchedule(tx, input);

  const closedDays = await tx.dayClosing.findMany({
    where: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      closedDate: { gte: new Date(input.transactionDate) },
    },
    select: { id: true, closedDate: true },
    orderBy: { closedDate: "asc" },
  });

  if (closedDays.length === 0) {
    return;
  }

  for (const closedDay of closedDays) {
    const status = await getDayClosingTrailStatus(tx, closedDay.id);
    if (status === "reopened") {
      continue;
    }

    if (input.allowClosedDayOverride) {
      await enforcePermission(tx, input.userId, "day-closing.override", PermissionAction.APPROVE);
      return;
    }

    throw new Error("Backdated writes before or on a closed day are not allowed.");
  }
}
