import { Prisma, VoucherType, type AccountingVoucher } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type VoucherLineInput = {
  accountId: string;
  description?: string;
  debit?: string | number | Prisma.Decimal;
  credit?: string | number | Prisma.Decimal;
};

type CreateVoucherInput = {
  companyId: string;
  financialYearId: string;
  voucherNo: string;
  voucherType: VoucherType;
  voucherDate: string | Date;
  narration?: string;
  sourceType?: string;
  sourceId?: string;
  createdById: string;
  lines: VoucherLineInput[];
};

function asDecimal(value: string | number | Prisma.Decimal | undefined) {
  return new Prisma.Decimal(value ?? 0);
}

export function assertBalancedVoucher(lines: VoucherLineInput[]) {
  const totalDebit = lines.reduce((sum, line) => sum.plus(asDecimal(line.debit)), new Prisma.Decimal(0));
  const totalCredit = lines.reduce((sum, line) => sum.plus(asDecimal(line.credit)), new Prisma.Decimal(0));

  if (totalDebit.lte(0) || totalCredit.lte(0) || !totalDebit.equals(totalCredit)) {
    throw new Error("Accounting voucher must be balanced with equal non-zero debit and credit totals.");
  }
}

export async function createBalancedVoucher(tx: Tx, input: CreateVoucherInput): Promise<AccountingVoucher> {
  assertBalancedVoucher(input.lines);

  const totalDebit = input.lines.reduce((sum, line) => sum.plus(asDecimal(line.debit)), new Prisma.Decimal(0));
  const totalCredit = input.lines.reduce((sum, line) => sum.plus(asDecimal(line.credit)), new Prisma.Decimal(0));

  return tx.accountingVoucher.create({
    data: {
      companyId: input.companyId,
      financialYearId: input.financialYearId,
      voucherNo: input.voucherNo,
      voucherType: input.voucherType,
      voucherDate: new Date(input.voucherDate),
      narration: input.narration,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdById: input.createdById,
      totalDebit,
      totalCredit,
      lines: {
        create: input.lines.map((line, index) => ({
          accountId: line.accountId,
          description: line.description,
          debit: asDecimal(line.debit),
          credit: asDecimal(line.credit),
          sortOrder: index + 1,
        })),
      },
    },
  });
}
