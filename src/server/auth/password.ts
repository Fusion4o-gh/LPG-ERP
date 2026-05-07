import { scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64);
}

export async function verifyPassword(password: string, passwordHash?: string | null) {
  if (!passwordHash) {
    return false;
  }

  const [scheme, salt, storedHash] = passwordHash.split("$");
  if (scheme !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const actual = hashPassword(password, salt);
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
