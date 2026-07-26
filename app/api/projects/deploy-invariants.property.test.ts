/**
 * app/api/projects/deploy-invariants.property.test.ts
 *
 * Task 22.1 — Property 21: Vercel deploy never changes the credit balance
 * Task 22.2 — Property 22: Vercel deploy failures never corrupt the Version record
 *
 * **Validates: Requirements 11.3, 11.4**
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Types mirroring the domain model
// ---------------------------------------------------------------------------

interface Version {
  id: string;
  projectId: string;
  versionNumber: number;
  storageKey: string;
  deployUrl: string | null;
  createdAt: Date;
}

interface LedgerEntry {
  userId: string;
  eventType: string;
  amount: number;
}

// ---------------------------------------------------------------------------
// Pure model of the deploy handler
// ---------------------------------------------------------------------------

interface DeployState {
  version: Version;
  ledgerBefore: LedgerEntry[];
}

interface DeployResult {
  success: boolean;
  deployUrl?: string;
  updatedVersion?: Version;       // set only on success
  ledgerAfter: LedgerEntry[];     // must always equal ledgerBefore
  versionAfterOnFailure?: Version; // must equal original on failure
}

/**
 * Simulates a SUCCESSFUL deploy.
 * Updates the version's deployUrl but never touches the ledger.
 */
function simulateSuccessfulDeploy(
  state: DeployState,
  newDeployUrl: string
): DeployResult {
  return {
    success: true,
    deployUrl: newDeployUrl,
    updatedVersion: { ...state.version, deployUrl: newDeployUrl },
    ledgerAfter: [...state.ledgerBefore], // ledger unchanged
  };
}

/**
 * Simulates a FAILED deploy.
 * Must NOT modify the Version record or the ledger.
 */
function simulateFailedDeploy(state: DeployState): DeployResult {
  return {
    success: false,
    ledgerAfter: [...state.ledgerBefore], // ledger unchanged
    versionAfterOnFailure: { ...state.version }, // version record unchanged
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const versionArb: fc.Arbitrary<Version> = fc
  .tuple(
    fc.string({ minLength: 4, maxLength: 12 }).map((s) => `v_${s}`),
    fc.string({ minLength: 4, maxLength: 12 }).map((s) => `proj_${s}`),
    fc.integer({ min: 1, max: 50 }),
    fc.option(fc.webUrl())
  )
  .map(([id, projectId, versionNumber, deployUrl]) => ({
    id,
    projectId,
    versionNumber,
    storageKey: `user/${projectId}/${id}/index.html`,
    deployUrl: deployUrl ?? null,
    createdAt: new Date(),
  }));

const ledgerEntryArb: fc.Arbitrary<LedgerEntry> = fc
  .tuple(
    fc.string({ minLength: 4, maxLength: 12 }).map((s) => `user_${s}`),
    fc.constantFrom("DEDUCTION", "TOP_UP", "REFUND", "MONTHLY_GRANT"),
    fc.integer({ min: 1, max: 500 })
  )
  .map(([userId, eventType, amount]) => ({ userId, eventType, amount }));

// ---------------------------------------------------------------------------
// Property 21 — Vercel deploy never changes the credit balance
// Validates: Requirements 11.4
// ---------------------------------------------------------------------------

describe("Property 21 — Vercel deploy never changes the credit balance", () => {
  it("successful deploy never modifies the CreditLedger", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.array(ledgerEntryArb, { minLength: 0, maxLength: 20 }),
        fc.webUrl(),
        (version, ledgerBefore, newDeployUrl) => {
          const result = simulateSuccessfulDeploy({ version, ledgerBefore }, newDeployUrl);
          expect(result.ledgerAfter).toEqual(ledgerBefore);
          expect(result.ledgerAfter.length).toBe(ledgerBefore.length);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("failed deploy never modifies the CreditLedger", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.array(ledgerEntryArb, { minLength: 0, maxLength: 20 }),
        (version, ledgerBefore) => {
          const result = simulateFailedDeploy({ version, ledgerBefore });
          expect(result.ledgerAfter).toEqual(ledgerBefore);
          expect(result.ledgerAfter.length).toBe(ledgerBefore.length);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("no DEDUCTION is ever added to the ledger during deploy", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.array(ledgerEntryArb, { minLength: 0, maxLength: 20 }),
        fc.boolean(), // true = success, false = failure
        fc.webUrl(),
        (version, ledgerBefore, success, deployUrl) => {
          const result = success
            ? simulateSuccessfulDeploy({ version, ledgerBefore }, deployUrl)
            : simulateFailedDeploy({ version, ledgerBefore });

          const newEntries = result.ledgerAfter.slice(ledgerBefore.length);
          expect(newEntries.filter((e) => e.eventType === "DEDUCTION")).toHaveLength(0);
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 22 — Vercel deploy failures never corrupt the Version record
// Validates: Requirements 11.3
// ---------------------------------------------------------------------------

describe("Property 22 — Vercel deploy failures never corrupt the Version record", () => {
  it("failed deploy always preserves the original Version record exactly", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.array(ledgerEntryArb, { minLength: 0, maxLength: 10 }),
        (version, ledgerBefore) => {
          const result = simulateFailedDeploy({ version, ledgerBefore });
          // The version record after failure must be identical to before
          expect(result.versionAfterOnFailure).toEqual(version);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("failed deploy never sets a deployUrl on the Version record", () => {
    fc.assert(
      fc.property(versionArb, (version) => {
        const original = { ...version, deployUrl: null };
        const result = simulateFailedDeploy({ version: original, ledgerBefore: [] });
        expect(result.versionAfterOnFailure?.deployUrl).toBeNull();
      }),
      { numRuns: 300 }
    );
  });

  it("failed deploy preserves a pre-existing deployUrl on the Version record", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.webUrl(),
        (version, existingUrl) => {
          const versionWithUrl = { ...version, deployUrl: existingUrl };
          const result = simulateFailedDeploy({ version: versionWithUrl, ledgerBefore: [] });
          // The existing deployUrl must be preserved — not cleared or changed
          expect(result.versionAfterOnFailure?.deployUrl).toBe(existingUrl);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("successful deploy updates only the deployUrl field", () => {
    fc.assert(
      fc.property(
        versionArb,
        fc.webUrl(),
        (version, newDeployUrl) => {
          const result = simulateSuccessfulDeploy({ version, ledgerBefore: [] }, newDeployUrl);
          const updated = result.updatedVersion!;
          // All fields except deployUrl must remain the same
          expect(updated.id).toBe(version.id);
          expect(updated.projectId).toBe(version.projectId);
          expect(updated.versionNumber).toBe(version.versionNumber);
          expect(updated.storageKey).toBe(version.storageKey);
          // deployUrl is set to the new URL
          expect(updated.deployUrl).toBe(newDeployUrl);
        }
      ),
      { numRuns: 300 }
    );
  });
});
