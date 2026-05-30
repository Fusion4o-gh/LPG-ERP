import "./test-env.mjs";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__testPrisma ?? new PrismaClient();

if (!globalForPrisma.__testPrisma) {
  globalForPrisma.__testPrisma = prisma;
}
