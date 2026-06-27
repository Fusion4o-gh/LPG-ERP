import { AccountType, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Server-side enforcement of which account types may appear on the user-selectable
 * (counter) lines of each voucher kind. This is the authoritative source of truth;
 * the client-side filter in MultiLinePaymentForm is only a convenience layer.
 *
 * Keys mirror the payment module identifiers used by the API/routes.
 */
export const COUNTER_ACCOUNT_TYPES = {
  "cash-receipts": [AccountType.ASSET, AccountType.LIABILITY, AccountType.REVENUE],
  "bank-receipts": [AccountType.ASSET, AccountType.LIABILITY, AccountType.REVENUE],
  "cash-payments": [AccountType.ASSET, AccountType.LIABILITY, AccountType.EXPENSE],
  "bank-payments": [AccountType.ASSET, AccountType.LIABILITY, AccountType.EXPENSE],
  // Journal vouchers are free-form across all five account types.
  "journal-vouchers": [
    AccountType.ASSET,
    AccountType.LIABILITY,
    AccountType.EQUITY,
    AccountType.REVENUE,
    AccountType.EXPENSE,
  ],
} as const;

export type PostingRuleKey = keyof typeof COUNTER_ACCOUNT_TYPES;

/**
 * Validates that every supplied account id exists for this company, is active, has an
 * allowed account type for the given voucher kind, and is not a top-level roll-up group
 * header. Throws a user-facing Error on the first violation.
 *
 * This is what keeps sales/purchase (revenue/stock) accounts from being mixed into
 * expense vouchers — and expenses from being mixed into receipts — regardless of how the
 * request reaches the API. It is enforced server-side because the only prior guard was a
 * client-side dropdown filter that a direct API call could bypass entirely.
 *
 * Notes on this codebase's chart-of-accounts design:
 * - Every customer/vendor shares the "Trade Debtors"/"Trade Creditors" CONTROL account
 *   (there are no per-party GL accounts), so posting to a control account is legitimate
 *   here and must NOT be blocked.
 * - `isSystem` is set on every seeded account (it marks "protected from editing", not
 *   "not postable"), so it is not a blocker either.
 * - The only accounts that must never receive a posting are the five top-level group
 *   roots (Assets / Liabilities / Equity / Revenue / Expenses), identified by having no
 *   parent. Those are rejected below.
 */
export async function assertPostingAccountsAllowed(
  tx: Tx,
  companyId: string,
  ruleKey: PostingRuleKey,
  accountIds: string[],
) {
  const uniqueIds = [...new Set(accountIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const allowedTypes = COUNTER_ACCOUNT_TYPES[ruleKey] as readonly AccountType[];

  const accounts = await tx.chartAccount.findMany({
    where: { companyId, id: { in: uniqueIds } },
    select: { id: true, code: true, name: true, accountType: true, status: true, parentId: true },
  });
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  for (const id of uniqueIds) {
    const account = accountById.get(id);
    if (!account) {
      throw new Error("Selected account does not exist for this company.");
    }
    if (account.status !== "ACTIVE") {
      throw new Error(`Account ${account.code} - ${account.name} is not active and cannot be posted to.`);
    }
    if (account.parentId === null) {
      throw new Error(
        `Account ${account.code} - ${account.name} is a top-level group and cannot be posted to directly.`,
      );
    }
    if (!allowedTypes.includes(account.accountType)) {
      throw new Error(
        `Account ${account.code} - ${account.name} (${account.accountType.toLowerCase()}) is not permitted on this voucher.`,
      );
    }
  }
}
