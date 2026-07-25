/**
 * lib/billing/credits.ts
 *
 * Pure credit-ledger helpers.
 *
 * All functions interact only with the CreditLedger table through the Prisma
 * client.  They accept an optional `tx` (Prisma.TransactionClient) parameter
 * so they can be composed inside a single DB transaction when required.
 *
 * Design note: `balanceAfter` is a denormalised snapshot that lets us retrieve
 * the current balance with a single O(1) query (latest row) rather than
 * summing the entire ledger.  It is always set atomically inside a transaction
 * or the individual insert when no transaction is provided.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { CreditEventType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

// Re-export so callers can import the enum from one place.
export { CreditEventType };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape of a row returned from CreditLedger queries. */
export interface CreditLedgerEntry {
  id: string;
  userId: string;
  eventType: CreditEventType;
  amount: number;
  balanceAfter: number;
  generationJobId: string | null;
  stripePaymentId: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the Prisma client to use — either the provided transaction client
 * or the global singleton.
 */
function client(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
  return (tx ?? db) as unknown as Prisma.TransactionClient;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the user's current credit balance.
 *
 * Reads the `balanceAfter` column from the most recent CreditLedger row for
 * the user (ordered by `createdAt DESC`).  Returns 0 if no ledger entries
 * exist yet.
 *
 * @param userId  The user whose balance to query.
 * @param tx      Optional transaction client.
 */
export async function getCreditBalance(
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const c = client(tx);
  const latest = await c.creditLedger.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

/**
 * Returns true if the user has a credit balance strictly greater than zero.
 *
 * This is the guard used before enqueueing any generation job.
 * Satisfies Requirements 2.4 and 3.4: zero-credit users are always blocked.
 *
 * @param userId  The user to check.
 * @param tx      Optional transaction client.
 */
export async function hasSufficientCredits(
  userId: string,
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const balance = await getCreditBalance(userId, tx);
  return balance > 0;
}

/**
 * Inserts a DEDUCTION ledger entry and returns the new entry.
 *
 * `balanceAfter` = currentBalance − amount.
 * Negative balances are not prevented at this layer; callers must call
 * `hasSufficientCredits` first.
 *
 * @param userId  The user being charged.
 * @param amount  Positive integer number of credits to deduct.
 * @param jobId   The GenerationJob ID that triggered the deduction.
 * @param tx      Optional transaction client.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  jobId: string,
  tx?: Prisma.TransactionClient
): Promise<CreditLedgerEntry> {
  const c = client(tx);
  const currentBalance = await getCreditBalance(userId, tx);
  const balanceAfter = currentBalance - amount;

  return c.creditLedger.create({
    data: {
      userId,
      eventType: CreditEventType.DEDUCTION,
      amount,
      balanceAfter,
      generationJobId: jobId,
    },
  });
}

/**
 * Inserts a REFUND ledger entry and returns the new entry.
 *
 * Used when a generation job fails to restore the credits previously deducted.
 * `balanceAfter` = currentBalance + amount.
 *
 * @param userId  The user being refunded.
 * @param amount  Positive integer number of credits to restore.
 * @param jobId   The GenerationJob ID that triggered the refund.
 * @param tx      Optional transaction client.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  jobId: string,
  tx?: Prisma.TransactionClient
): Promise<CreditLedgerEntry> {
  const c = client(tx);
  const currentBalance = await getCreditBalance(userId, tx);
  const balanceAfter = currentBalance + amount;

  return c.creditLedger.create({
    data: {
      userId,
      eventType: CreditEventType.REFUND,
      amount,
      balanceAfter,
      generationJobId: jobId,
    },
  });
}

/**
 * Inserts a MONTHLY_GRANT ledger entry and returns the new entry.
 *
 * Called at the start of each billing cycle (Stripe webhook: invoice.payment_succeeded
 * or customer.subscription.updated) to credit the tier's monthly allowance.
 * `balanceAfter` = currentBalance + amount.
 *
 * @param userId  The user receiving the monthly grant.
 * @param amount  Number of credits to grant (from TIER_CONFIG).
 * @param tx      Optional transaction client.
 */
export async function grantMonthlyCredits(
  userId: string,
  amount: number,
  tx?: Prisma.TransactionClient
): Promise<CreditLedgerEntry> {
  const c = client(tx);
  const currentBalance = await getCreditBalance(userId, tx);
  const balanceAfter = currentBalance + amount;

  return c.creditLedger.create({
    data: {
      userId,
      eventType: CreditEventType.MONTHLY_GRANT,
      amount,
      balanceAfter,
    },
  });
}
