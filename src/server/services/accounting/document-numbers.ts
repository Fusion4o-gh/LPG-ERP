import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma.ts";

export const DOCUMENT_PREFIXES = {
  purchaseReceipt: "PR",
  saleIssue: "SI",
  batchSaleIssue: "BSI",
  cylinderReturn: "RTN",
  cashReceiptVoucher: "CRV",
  cashPaymentVoucher: "CPV",
  bankReceiptVoucher: "BRV",
  bankPaymentVoucher: "BPV",
  securityReceipt: "SR",
  cylinderConversion: "CC",
  emptySaleIssue: "ES",
  decantingSaleIssue: "DS",
  journalVoucher: "JV",
  // --- Bulk / import / dollar / plant extension ---
  importContract: "IMC",
  loading: "LOAD",
  purchaseContract: "PUC",
  saleContract: "SLC",
  localPurchase: "LP",
  deliveredSale: "DSL",
  plantDecanting: "PDC",
  fillingSale: "FS",
  plantBulkSale: "PBS",
  plantTransfer: "PT",
  partialReceiving: "PRC",
  lossGain: "LG",
  dollarPurchase: "DP",
  dollarSale: "DSALE",
  openingVoucher: "OPV",
} as const;

type Tx = Prisma.TransactionClient;

type DocumentNumberInput = {
  companyId: string;
  financialYearId: string;
  prefix: string;
};

function formatDocumentNumber(prefix: string, financialYearLabel: string, sequence: number) {
  return `${prefix}-${financialYearLabel}-${String(sequence).padStart(6, "0")}`;
}

export async function nextDocumentNumberInTransaction(tx: Tx, input: DocumentNumberInput) {
  const financialYear = await tx.financialYear.findUniqueOrThrow({
    where: { id: input.financialYearId },
    select: { label: true },
  });

  const sequence = await tx.documentSequence.upsert({
    where: {
      companyId_financialYearId_prefix: {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        prefix: input.prefix,
      },
    },
    create: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      prefix: input.prefix,
      nextNumber: 2,
    },
    update: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });

  return formatDocumentNumber(input.prefix, financialYear.label, sequence.nextNumber - 1);
}

export async function nextDocumentNumber(input: DocumentNumberInput) {
  return prisma.$transaction((tx) => nextDocumentNumberInTransaction(tx, input));
}

export async function peekNextDocumentNumber(input: DocumentNumberInput) {
  const financialYear = await prisma.financialYear.findUniqueOrThrow({
    where: { id: input.financialYearId },
    select: { label: true },
  });
  const sequence = await prisma.documentSequence.findUnique({
    where: {
      companyId_financialYearId_prefix: {
        companyId: input.companyId,
        financialYearId: input.financialYearId,
        prefix: input.prefix,
      },
    },
    select: { nextNumber: true },
  });
  return formatDocumentNumber(input.prefix, financialYear.label, sequence?.nextNumber ?? 1);
}
