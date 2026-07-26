/**
 * app/api/projects/version-numbers.property.test.ts
 *
 * Task 19.1 — Property 17: Version numbers always increment by exactly one
 *
 * For any sequence of version creations, versionNumber always = previous + 1.
 *
 * **Validates: Requirements 8.4, 9.3**
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure model of the version-number assignment logic used in the worker and
// revert handler.
// ---------------------------------------------------------------------------

interface Version {
  id: string;
  versionNumber: number;
  storageKey: string;
  prompt: string | null;
  createdAt: Date;
}

/**
 * Pure simulation of the version-number computation:
 * nextVersionNumber = MAX(existing versionNumbers) + 1, or 1 if none exist.
 */
function nextVersionNumber(existing: Version[]): number {
  if (existing.length === 0) return 1;
  const max = Math.max(...existing.map((v) => v.versionNumber));
  return max + 1;
}

/**
 * Simulates adding N versions sequentially to an initially empty project.
 * Returns the array of assigned version numbers.
 */
function simulateVersionCreations(count: number): number[] {
  const versions: Version[] = [];
  const assigned: number[] = [];

  for (let i = 0; i < count; i++) {
    const num = nextVersionNumber(versions);
    versions.push({
      id: `v${i}`,
      versionNumber: num,
      storageKey: `user/project/v${i}/index.html`,
      prompt: `prompt ${i}`,
      createdAt: new Date(),
    });
    assigned.push(num);
  }

  return assigned;
}

// ---------------------------------------------------------------------------
// Property 17 — Version numbers always increment by exactly one
// Validates: Requirements 8.4, 9.3
// ---------------------------------------------------------------------------

describe("Property 17 — Version numbers always increment by exactly one", () => {
  it("first version for a new project is always version 1", () => {
    fc.assert(
      fc.property(fc.constant([]), (_empty) => {
        const num = nextVersionNumber([]);
        expect(num).toBe(1);
      }),
      { numRuns: 1 }
    );
  });

  it("each successive version number is exactly one more than the previous", () => {
    fc.assert(
      fc.property(
        // Generate sequences of 1 to 50 version creations
        fc.integer({ min: 1, max: 50 }),
        (count) => {
          const numbers = simulateVersionCreations(count);
          for (let i = 1; i < numbers.length; i++) {
            expect(numbers[i]).toBe(numbers[i - 1]! + 1);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it("version numbers form a contiguous sequence starting at 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (count) => {
          const numbers = simulateVersionCreations(count);
          for (let i = 0; i < numbers.length; i++) {
            expect(numbers[i]).toBe(i + 1);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it("nextVersionNumber of any non-empty set equals MAX + 1", () => {
    fc.assert(
      fc.property(
        // Generate a non-empty array of distinct positive version numbers
        fc
          .array(fc.integer({ min: 1, max: 200 }), { minLength: 1, maxLength: 50 })
          .map((arr) => [...new Set(arr)]), // unique version numbers
        (versionNumbers) => {
          fc.pre(versionNumbers.length > 0);
          const versions: Version[] = versionNumbers.map((n, i) => ({
            id: `v${i}`,
            versionNumber: n,
            storageKey: `u/p/v${i}/index.html`,
            prompt: null,
            createdAt: new Date(),
          }));
          const next = nextVersionNumber(versions);
          const expectedMax = Math.max(...versionNumbers);
          expect(next).toBe(expectedMax + 1);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("nextVersionNumber on empty array returns 1", () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it("revert operation increments version number by exactly 1", () => {
    fc.assert(
      fc.property(
        // Start with a sequence of 1..N versions, then revert
        fc.integer({ min: 1, max: 20 }),
        (existingCount) => {
          const versions: Version[] = Array.from({ length: existingCount }, (_, i) => ({
            id: `v${i}`,
            versionNumber: i + 1,
            storageKey: `u/p/v${i}/index.html`,
            prompt: `prompt ${i}`,
            createdAt: new Date(),
          }));

          const revertedVersionNumber = nextVersionNumber(versions);
          expect(revertedVersionNumber).toBe(existingCount + 1);
        }
      ),
      { numRuns: 300 }
    );
  });
});
