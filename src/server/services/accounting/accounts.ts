import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const ACCOUNT_CODES = {
  cash: "2003010001",
  stock: "2003001001",
  sales: "3001001001",
  gstReceivable: "2004003001",
  gstPayable: "1001003001",
  securityLiability: "1001002001",
} as const;

export async function getAccountIdByCode(tx: Tx, companyId: string, code: string) {
  const account = await tx.chartAccount.findUnique({
    where: { companyId_code: { companyId, code } },
    select: { id: true },
  });

  if (!account) {
    throw new Error(`Required chart account ${code} is not configured.`);
  }

  return account.id;
}

export async function getCashAccountId(tx: Tx, companyId: string) {
  return getAccountIdByCode(tx, companyId, ACCOUNT_CODES.cash);
}

export async function getBankAccountId(tx: Tx, bankId: string) {
  const bank = await tx.bank.findUnique({ where: { id: bankId }, select: { accountId: true } });
  if (!bank) {
    throw new Error("Bank is not configured.");
  }
  return bank.accountId;
}
