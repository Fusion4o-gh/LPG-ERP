import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const ACCOUNT_CODES = {
  cash: "2003010001",
  stock: "2003001001",
  cogs: "4001002001",
  sales: "3001001001",
  salesDiscount: "4001001501",
  purchaseDiscount: "4001001502",
  gstReceivable: "2004003001",
  gstPayable: "1001003001",
  securityLiability: "1001002001",
  // --- Bulk / import / dollar / plant extension ---
  bulkStock: "2003002001",
  bulkStockInTransit: "2003003001",
  bulkSales: "3001002001",
  inventoryGain: "3001003001",
  exchangeGain: "3002001001",
  freight: "4001003001",
  inventoryLoss: "4001004001",
  exchangeLoss: "4002001001",
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
