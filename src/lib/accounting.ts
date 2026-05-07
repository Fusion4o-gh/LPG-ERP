export type VoucherLineInput = {
  accountId: string;
  debit?: string | number;
  credit?: string | number;
};

export function assertBalancedVoucher(lines: VoucherLineInput[]) {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);

  if (debit <= 0 || credit <= 0 || Math.abs(debit - credit) > 0.0001) {
    throw new Error("Accounting voucher must have equal non-zero debit and credit totals.");
  }
}
