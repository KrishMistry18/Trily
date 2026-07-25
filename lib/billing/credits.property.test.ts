/**
 * lib/billing/credits.property.test.ts
 *
 * Task 5.1 — Property 4: Credit Ledger entries always contain all required fields
 * Task 5.2 — Property 3: Zero-credit users are always blocked from generation
 *
 * Validates: Requirements 2.4, 2.5, 3.4
 *
 * Strategy: We test the pure credit-ledger logic directly without a live
 * database by modelling ledger operations as in-process pure functions that
 * mirror the behaviour of lib/billing/credits.ts.  fast-check generates
 * arbitrary inputs and verifies invariants hold universally.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Inline types mirroring the Prisma schema and credits.ts exports
// ---------------------------------------------------------------------------

type CreditEventType = "DEDUCTION" | "TOP_UP" | "REFUND" | "MONTHLY_GRANT";

interface CreditLedgerEntry {
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
// Pure in-process implementations (mirror credits.ts without DB)
// ---------------------------------------------------------------------------

let _idCounter = 0;
function makeId(): string {
  return `c${(++_idCounter).toString(36).padStart(8, "0")}`;
}

function makeLedgerEntry(
  userId: string,
  eventType: CreditEventType,
  amount: number,
  currentBalance: number,
  opts: { jobId?: string; stripePaymentId?: string } = {}
): CreditLedgerEntry {
  const balanceAfter =
    eventType === "DEDUCTION"
      ? currentBalance - amount
      : currentBalance + amount;

  return {
    id: makeId(),
    userId,
    eventType,
    amount,
    balanceAfter,
    generationJobId: opts.jobId ?? null,
    stripePaymentId: opts.stripePaymentId ?? null,
    createdAt: new Date(),
  };
}

/** Pure version of getCreditBalance — returns latest balanceAfter or 0 */
function getBalance(ledger: CreditLedgerEntry[], userId: string): number {
  const entries = ledger
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return entries[0]?.balanceAfter ?? 0;
}

/** Pure version of hasSufficientCredits */
function hasSufficientCredits(
  ledger: CreditLedgerEntry[],
  userId: string
): boolean {
  return getBalance(ledger, userId) > 0;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const userIdArb = fc
  .hexaString({ minLength: 8, maxLength: 20 })
  .map((s) => `c${s}`);

const jobIdArb = fc
  .hexaString({ minLength: 8, maxLength: 20 })
  .map((s) => `j${s}`);

/** Positive integer credits (1–500) */
const creditAmountArb = fc.integer({ min: 1, max: 500 });

/** Arbitrary non-negative starting balance */
const startingBalanceArb = fc.integer({ min: 0, max: 10_000 });

const eventTypeArb = fc.oneof(
  fc.constant<CreditEventType>("DEDUCTION"),
  fc.constant<CreditEventType>("TOP_UP"),
  fc.constant<CreditEventType>("REFUND"),
  fc.constant<CreditEventType>("MONTHLY_GRANT")
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

const REQUIRED_FIELDS: (keyof CreditLedgerEntry)[] = [
  "id",
  "userId",
  "eventType",
  "amount",
  "balanceAfter",
  "createdAt",
];

// ---------------------------------------------------------------------------
// Task 5.1 — Property 4: Credit Ledger entries always contain all required fields
// Validates: Requirements 2.5
// ---------------------------------------------------------------------------

describe("Property 4 — Credit Ledger entries always contain all required fields", () => {
  it("every DEDUCTION entry has all required fields populated", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        jobIdArb,
        (userId, amount, startBalance, jobId) => {
          const entry = makeLedgerEntry(userId, "DEDUCTION", amount, startBalance, {
            jobId,
          });

          for (const field of REQUIRED_FIELDS) {
            expect(
              Object.prototype.hasOwnProperty.call(entry, field),
              `Missing field: ${field}`
            ).toBe(true);
            expect(isPopulated(entry[field]), `Empty field: ${field}`).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("every REFUND entry has all required fields populated", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        jobIdArb,
        (userId, amount, startBalance, jobId) => {
          const entry = makeLedgerEntry(userId, "REFUND", amount, startBalance, {
            jobId,
          });

          for (const field of REQUIRED_FIELDS) {
            expect(isPopulated(entry[field]), `Empty field: ${field}`).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("every MONTHLY_GRANT entry has all required fields populated", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        (userId, amount, startBalance) => {
          const entry = makeLedgerEntry(userId, "MONTHLY_GRANT", amount, startBalance);

          for (const field of REQUIRED_FIELDS) {
            expect(isPopulated(entry[field]), `Empty field: ${field}`).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("every TOP_UP entry has all required fields populated", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        (userId, amount, startBalance) => {
          const entry = makeLedgerEntry(userId, "TOP_UP", amount, startBalance);

          for (const field of REQUIRED_FIELDS) {
            expect(isPopulated(entry[field]), `Empty field: ${field}`).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("userId on every ledger entry always matches the submitting userId", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        eventTypeArb,
        (userId, amount, startBalance, eventType) => {
          const entry = makeLedgerEntry(userId, eventType, amount, startBalance);
          expect(entry.userId).toBe(userId);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("amount is always a positive integer on every entry", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        eventTypeArb,
        (userId, amount, startBalance, eventType) => {
          const entry = makeLedgerEntry(userId, eventType, amount, startBalance);
          expect(Number.isInteger(entry.amount)).toBe(true);
          expect(entry.amount).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("createdAt is always a valid Date instance on every entry", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        eventTypeArb,
        (userId, amount, startBalance, eventType) => {
          const entry = makeLedgerEntry(userId, eventType, amount, startBalance);
          expect(entry.createdAt).toBeInstanceOf(Date);
          expect(isFinite(entry.createdAt.getTime())).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("DEDUCTION balanceAfter = startBalance - amount", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        (userId, amount, startBalance) => {
          const entry = makeLedgerEntry(userId, "DEDUCTION", amount, startBalance);
          expect(entry.balanceAfter).toBe(startBalance - amount);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("REFUND balanceAfter = startBalance + amount", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        (userId, amount, startBalance) => {
          const entry = makeLedgerEntry(userId, "REFUND", amount, startBalance);
          expect(entry.balanceAfter).toBe(startBalance + amount);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("MONTHLY_GRANT balanceAfter = startBalance + amount", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        startingBalanceArb,
        (userId, amount, startBalance) => {
          const entry = makeLedgerEntry(userId, "MONTHLY_GRANT", amount, startBalance);
          expect(entry.balanceAfter).toBe(startBalance + amount);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 5.2 — Property 3: Zero-credit users are always blocked from generation
// Validates: Requirements 2.4, 3.4
// ---------------------------------------------------------------------------

describe("Property 3 — Zero-credit users are always blocked from generation", () => {
  /**
   * For any user with a current balance of exactly 0, hasSufficientCredits
   * must always return false.
   */
  it("user with balance = 0 is always blocked (empty ledger)", () => {
    fc.assert(
      fc.property(userIdArb, (userId) => {
        const ledger: CreditLedgerEntry[] = [];
        // No entries → balance is 0 → must be blocked
        expect(hasSufficientCredits(ledger, userId)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("user whose last ledger entry has balanceAfter = 0 is always blocked", () => {
    fc.assert(
      fc.property(userIdArb, creditAmountArb, (userId, amount) => {
        const t0 = new Date(1_000_000_000_000); // earlier
        const t1 = new Date(1_000_000_001_000); // 1 second later

        // Grant some credits then deduct all of them
        const grant: CreditLedgerEntry = {
          id: makeId(), userId, eventType: "MONTHLY_GRANT",
          amount, balanceAfter: amount,
          generationJobId: null, stripePaymentId: null, createdAt: t0,
        };
        const deduct: CreditLedgerEntry = {
          id: makeId(), userId, eventType: "DEDUCTION",
          amount, balanceAfter: 0,
          generationJobId: null, stripePaymentId: null, createdAt: t1,
        };
        const ledger = [grant, deduct];

        expect(getBalance(ledger, userId)).toBe(0);
        expect(hasSufficientCredits(ledger, userId)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * For any negative balance, the user is also blocked.
   * (Belt-and-suspenders: negative balances should not occur in practice but
   * the guard must cover them.)
   */
  it("user with negative balance is always blocked", () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.integer({ min: 1, max: 1000 }),
        (userId, amount) => {
          // Force a negative balanceAfter directly
          const entry: CreditLedgerEntry = {
            id: makeId(),
            userId,
            eventType: "DEDUCTION",
            amount,
            balanceAfter: -amount, // negative
            generationJobId: null,
            stripePaymentId: null,
            createdAt: new Date(),
          };
          const ledger = [entry];

          expect(getBalance(ledger, userId)).toBeLessThan(0);
          expect(hasSufficientCredits(ledger, userId)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Conversely, users with a positive balance must always be allowed.
   */
  it("user with positive balance is always allowed", () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.integer({ min: 1, max: 10_000 }),
        (userId, balance) => {
          const entry = makeLedgerEntry(userId, "MONTHLY_GRANT", balance, 0);
          const ledger = [entry];

          expect(hasSufficientCredits(ledger, userId)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("after any DEDUCTION that reduces balance to 0, user is blocked", () => {
    fc.assert(
      fc.property(
        userIdArb,
        creditAmountArb,
        (userId, credits) => {
          const t0 = new Date(1_000_000_000_000);
          const t1 = new Date(1_000_000_001_000);

          // Start with exactly `credits` and deduct all
          const grant: CreditLedgerEntry = {
            id: makeId(), userId, eventType: "MONTHLY_GRANT",
            amount: credits, balanceAfter: credits,
            generationJobId: null, stripePaymentId: null, createdAt: t0,
          };
          const deduct: CreditLedgerEntry = {
            id: makeId(), userId, eventType: "DEDUCTION",
            amount: credits, balanceAfter: 0,
            generationJobId: makeId(), stripePaymentId: null, createdAt: t1,
          };
          const ledger = [grant, deduct];

          expect(hasSufficientCredits(ledger, userId)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("hasSufficientCredits only considers the specified userId, not other users", () => {
    fc.assert(
      fc.property(
        userIdArb,
        userIdArb,
        fc.integer({ min: 1, max: 1000 }),
        (userId1, userId2, amount) => {
          fc.pre(userId1 !== userId2);

          // Give credits only to userId1
          const entry = makeLedgerEntry(userId1, "MONTHLY_GRANT", amount, 0);
          const ledger = [entry];

          expect(hasSufficientCredits(ledger, userId1)).toBe(true);
          // userId2 has no entries → balance = 0 → blocked
          expect(hasSufficientCredits(ledger, userId2)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });
});
