export type UiPermission = string;

export function canAccess(permissions: UiPermission[], module: string, action = "VIEW") {
  return permissions.includes(`${module}:${action}`);
}

export function canAny(permissions: UiPermission[], checks: Array<{ module: string; action?: string }>) {
  return checks.some((check) => canAccess(permissions, check.module, check.action ?? "VIEW"));
}

