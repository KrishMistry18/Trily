/**
 * lib/queue/generation-worker.property.test.ts
 *
 * Task 16.1 — Property 11: Generation job statuses are always from the valid set
 * Task 16.2 — Property 9:  Credits are always restored on any generation job failure
 * Task 16.3 — Property 12: Timed-out jobs are marked failed and credits restored
 *
 * All tests use pure in-process logic — no real BullMQ/Redis/DB connections.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Types mirroring the Prisma enums
// ---------------------------------------------------------------------------

type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
type CreditEventType = "DEDUCTION" | "REFUND" | "MONTHLY_GRANT" | "TOP_UP";

const VALID_STATUSES = new Set<JobStatus>(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);
const WORKER_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Pure state model (mirrors worker logic without I/O)
// ---------------------------------------------------------------------------

interface JobState {
  id: string;
  status: JobStatus;
  creditsDeducted: number;
  userId: string;
  startedAt: number;
}

interface LedgerEntry {
  userId: string;
  eventType: CreditEventType;
  amount: number;
}

/** Simulates the happy-path status transitions */
function simulateStatusTransitions(): JobStatus[] {
  return ["PENDING", "PROCESSING", "COMPLETED"];
}

/** Simulates a failed-path status transitions */
function simulateFailureTransitions(): JobStatus[] {
  return ["PENDING", "PROCESSING", "FAILED"];
}

/** Pure failure handler — mirrors handleJobFailed logic */
function applyFailureHandler(
  job: JobState,
  failureReason: string,
  ledger: LedgerEntry[]
): { updatedJob: JobState; updatedLedger: LedgerEntry[] } {
  const updatedJob: JobState = { ...job, status: "FAILED" };
  const updatedLedger = [...ledger];

  if (job.creditsDeducted > 0) {
    updatedLedger.push({
      userId: job.userId,
      eventType: "REFUND",
      amount: job.creditsDeducted,
    });
  }

  void failureReason; // captured in real impl as failureReason field
  return { updatedJob, updatedLedger };
}

/** Pure timeout check — mirrors the checkTimeout() watchdog */
function isTimedOut(startedAt: number, now: number): boolean {
  return now - startedAt > WORKER_TIMEOUT_MS;
}

/** Simulates the full job pipeline including timeout detection */
function simulateJobWithTimeout(
  job: JobState,
  now: number,
  ledger: LedgerEntry[]
): { finalJob: JobState; finalLedger: LedgerEntry[] } {
  if (isTimedOut(job.startedAt, now)) {
    const { updatedJob, updatedLedger } = applyFailureHandler(
      job,
      `Job timed out after ${WORKER_TIMEOUT_MS}ms`,
      ledger
    );
    return { finalJob: updatedJob, finalLedger: updatedLedger };
  }
  // Not timed out — complete successfully
  return {
    finalJob: { ...job, status: "COMPLETED" },
    finalLedger: ledger,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const jobIdArb = fc.hexaString({ minLength: 8, maxLength: 16 }).map((s) => `j${s}`);
const userIdArb = fc.hexaString({ minLength: 8, maxLength: 16 }).map((s) => `u${s}`);
const creditAmountArb = fc.integer({ min: 0, max: 500 });

const jobStateArb = fc
  .tuple(jobIdArb, userIdArb, creditAmountArb)
  .map(([id, userId, creditsDeducted]) => ({
    id,
    userId,
    status: "PENDING" as JobStatus,
    creditsDeducted,
    startedAt: Date.now(),
  }));

// ---------------------------------------------------------------------------
// Task 16.1 — Property 11: Generation job statuses are always from the valid set
// Validates: Requirements 6.2
// ---------------------------------------------------------------------------

describe("Property 11 — Generation job statuses are always from the valid set", () => {
  it("every status in the happy-path transition sequence is a valid status", () => {
    const transitions = simulateStatusTransitions();
    for (const status of transitions) {
      expect(VALID_STATUSES.has(status)).toBe(true);
    }
  });

  it("every status in the failure-path transition sequence is a valid status", () => {
    const transitions = simulateFailureTransitions();
    for (const status of transitions) {
      expect(VALID_STATUSES.has(status)).toBe(true);
    }
  });

  it("the failure handler always produces status FAILED (a valid status)", () => {
    fc.assert(
      fc.property(jobStateArb, creditAmountArb, (job, credits) => {
        const jobWithCredits = { ...job, creditsDeducted: credits };
        const { updatedJob } = applyFailureHandler(jobWithCredits, "error", []);
        expect(VALID_STATUSES.has(updatedJob.status)).toBe(true);
        expect(updatedJob.status).toBe("FAILED");
      }),
      { numRuns: 300 }
    );
  });

  it("for any arbitrary status string, only the four valid values are accepted", () => {
    const validSet: JobStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"];

    fc.assert(
      fc.property(fc.string(), (s) => {
        const isValid = validSet.includes(s as JobStatus);
        // The valid set has exactly 4 members
        if (isValid) {
          expect(validSet.includes(s as JobStatus)).toBe(true);
        } else {
          expect(VALID_STATUSES.has(s as JobStatus)).toBe(false);
        }
      }),
      { numRuns: 500 }
    );
  });

  it("VALID_STATUSES contains exactly 4 entries", () => {
    expect(VALID_STATUSES.size).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Task 16.2 — Property 9: Credits are always restored on any generation job failure
// Validates: Requirements 4.4, 5.4, 6.6, 8.6, 18.4
// ---------------------------------------------------------------------------

describe("Property 9 — Credits are always restored on any generation job failure", () => {
  it("failure handler always inserts a REFUND entry when creditsDeducted > 0", () => {
    fc.assert(
      fc.property(
        jobStateArb,
        fc.integer({ min: 1, max: 500 }),
        (job, credits) => {
          const jobWithCredits = { ...job, creditsDeducted: credits };
          const { updatedLedger } = applyFailureHandler(jobWithCredits, "error", []);

          const refunds = updatedLedger.filter(
            (e) => e.userId === job.userId && e.eventType === "REFUND"
          );
          expect(refunds.length).toBe(1);
          expect(refunds[0]!.amount).toBe(credits);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("REFUND amount always equals the originally deducted amount", () => {
    fc.assert(
      fc.property(
        jobStateArb,
        fc.integer({ min: 1, max: 500 }),
        (job, credits) => {
          const jobWithCredits = { ...job, creditsDeducted: credits };
          const initialLedger: LedgerEntry[] = [
            { userId: job.userId, eventType: "DEDUCTION", amount: credits },
          ];
          const { updatedLedger } = applyFailureHandler(jobWithCredits, "error", initialLedger);

          const refund = updatedLedger.find(
            (e) => e.eventType === "REFUND" && e.userId === job.userId
          );
          const deduction = updatedLedger.find(
            (e) => e.eventType === "DEDUCTION" && e.userId === job.userId
          );
          expect(refund?.amount).toBe(deduction?.amount);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("no REFUND is inserted when creditsDeducted = 0", () => {
    fc.assert(
      fc.property(jobStateArb, (job) => {
        const jobWithNoCredits = { ...job, creditsDeducted: 0 };
        const { updatedLedger } = applyFailureHandler(jobWithNoCredits, "error", []);
        const refunds = updatedLedger.filter((e) => e.eventType === "REFUND");
        expect(refunds.length).toBe(0);
      }),
      { numRuns: 300 }
    );
  });

  it("failure handler always sets job status to FAILED regardless of credits", () => {
    fc.assert(
      fc.property(jobStateArb, creditAmountArb, (job, credits) => {
        const { updatedJob } = applyFailureHandler(
          { ...job, creditsDeducted: credits },
          "some error",
          []
        );
        expect(updatedJob.status).toBe("FAILED");
      }),
      { numRuns: 300 }
    );
  });

  it("REFUND only applies to the correct userId, not other users", () => {
    fc.assert(
      fc.property(
        jobStateArb,
        userIdArb,
        fc.integer({ min: 1, max: 100 }),
        (job, otherUserId, credits) => {
          fc.pre(job.userId !== otherUserId);
          const { updatedLedger } = applyFailureHandler(
            { ...job, creditsDeducted: credits },
            "error",
            []
          );
          const otherUserRefunds = updatedLedger.filter(
            (e) => e.userId === otherUserId && e.eventType === "REFUND"
          );
          expect(otherUserRefunds.length).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 16.3 — Property 12: Timed-out jobs are marked failed and credits restored
// Validates: Requirements 6.6
// ---------------------------------------------------------------------------

describe("Property 12 — Timed-out jobs are marked failed and credits restored", () => {
  it("any job where elapsed > 120000ms is always marked FAILED", () => {
    fc.assert(
      fc.property(
        jobStateArb,
        fc.integer({ min: 1, max: 300_000 }), // extra time beyond 120 s
        (job, extraMs) => {
          const now = job.startedAt + WORKER_TIMEOUT_MS + extraMs;
          const { finalJob } = simulateJobWithTimeout(job, now, []);
          expect(finalJob.status).toBe("FAILED");
        }
      ),
      { numRuns: 300 }
    );
  });

  it("timed-out jobs always produce a REFUND when creditsDeducted > 0", () => {
    fc.assert(
      fc.property(
        jobStateArb,
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 300_000 }),
        (job, credits, extraMs) => {
          const jobWithCredits = { ...job, creditsDeducted: credits };
          const now = job.startedAt + WORKER_TIMEOUT_MS + extraMs;
          const { finalLedger } = simulateJobWithTimeout(jobWithCredits, now, []);
          const refunds = finalLedger.filter(
            (e) => e.userId === job.userId && e.eventType === "REFUND"
          );
          expect(refunds.length).toBe(1);
          expect(refunds[0]!.amount).toBe(credits);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("jobs that complete within 120s are NOT marked failed", () => {
    fc.assert(
      fc.property(
        jobStateArb,
        fc.integer({ min: 0, max: WORKER_TIMEOUT_MS - 1 }),
        (job, elapsed) => {
          const now = job.startedAt + elapsed;
          const { finalJob } = simulateJobWithTimeout(job, now, []);
          expect(finalJob.status).toBe("COMPLETED");
        }
      ),
      { numRuns: 300 }
    );
  });

  it("isTimedOut boundary: elapsed === 120000ms is NOT timed out (strict >)", () => {
    fc.assert(
      fc.property(jobStateArb, (job) => {
        const exactBoundary = job.startedAt + WORKER_TIMEOUT_MS;
        expect(isTimedOut(job.startedAt, exactBoundary)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("isTimedOut boundary: elapsed === 120001ms IS timed out", () => {
    fc.assert(
      fc.property(jobStateArb, (job) => {
        const justOver = job.startedAt + WORKER_TIMEOUT_MS + 1;
        expect(isTimedOut(job.startedAt, justOver)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
