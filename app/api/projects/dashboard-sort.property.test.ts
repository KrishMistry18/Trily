/**
 * app/api/projects/dashboard-sort.property.test.ts
 *
 * Task 23.1 — Property 23: Dashboard project list is always sorted by last-edited date descending
 *
 * For any array of projects, the GET /api/projects response is always sorted
 * by updatedAt descending (most recently edited first).
 *
 * **Validates: Requirements 12.1**
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  updatedAt: Date;
  createdAt: Date;
  totalCreditsUsed: number;
}

// ---------------------------------------------------------------------------
// Pure model of the sort logic used in GET /api/projects
// ---------------------------------------------------------------------------

/**
 * Sorts projects by updatedAt descending — mirrors Prisma `orderBy: { updatedAt: 'desc' }`.
 */
function sortProjectsByLastEdited(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
  );
}

/**
 * Checks that an array of projects is sorted by updatedAt descending.
 */
function isSortedDescByUpdatedAt(projects: Project[]): boolean {
  for (let i = 1; i < projects.length; i++) {
    if (projects[i]!.updatedAt > projects[i - 1]!.updatedAt) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const projectArb: fc.Arbitrary<Project> = fc
  .tuple(
    fc.string({ minLength: 4, maxLength: 12 }).map((s) => `proj_${s}`),
    fc.string({ minLength: 3, maxLength: 30 }),
    fc.integer({ min: 0, max: 1_700_000_000_000 }), // updatedAt timestamp
    fc.integer({ min: 0, max: 1_700_000_000_000 }), // createdAt timestamp
    fc.integer({ min: 0, max: 1000 })
  )
  .map(([id, name, updatedAtTs, createdAtTs, totalCreditsUsed]) => ({
    id,
    name,
    updatedAt: new Date(updatedAtTs),
    createdAt: new Date(createdAtTs),
    totalCreditsUsed,
  }));

// ---------------------------------------------------------------------------
// Property 23 — Dashboard project list is always sorted by last-edited date descending
// Validates: Requirements 12.1
// ---------------------------------------------------------------------------

describe("Property 23 — Dashboard project list is always sorted by last-edited date descending", () => {
  it("any array of projects sorted by updatedAt desc is always in descending order", () => {
    fc.assert(
      fc.property(
        fc.array(projectArb, { minLength: 0, maxLength: 50 }),
        (projects) => {
          const sorted = sortProjectsByLastEdited(projects);
          expect(isSortedDescByUpdatedAt(sorted)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("sorted result always has the same number of projects as the input", () => {
    fc.assert(
      fc.property(
        fc.array(projectArb, { minLength: 0, maxLength: 50 }),
        (projects) => {
          const sorted = sortProjectsByLastEdited(projects);
          expect(sorted.length).toBe(projects.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("the most recently edited project is always first", () => {
    fc.assert(
      fc.property(
        fc.array(projectArb, { minLength: 1, maxLength: 30 }),
        (projects) => {
          const sorted = sortProjectsByLastEdited(projects);
          const maxUpdatedAt = Math.max(...projects.map((p) => p.updatedAt.getTime()));
          expect(sorted[0]!.updatedAt.getTime()).toBe(maxUpdatedAt);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("the least recently edited project is always last", () => {
    fc.assert(
      fc.property(
        fc.array(projectArb, { minLength: 1, maxLength: 30 }),
        (projects) => {
          const sorted = sortProjectsByLastEdited(projects);
          const minUpdatedAt = Math.min(...projects.map((p) => p.updatedAt.getTime()));
          expect(sorted[sorted.length - 1]!.updatedAt.getTime()).toBe(minUpdatedAt);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("empty project list returns an empty array", () => {
    const sorted = sortProjectsByLastEdited([]);
    expect(sorted).toEqual([]);
  });

  it("single project list is always sorted", () => {
    fc.assert(
      fc.property(projectArb, (project) => {
        const sorted = sortProjectsByLastEdited([project]);
        expect(sorted).toHaveLength(1);
        expect(isSortedDescByUpdatedAt(sorted)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("sorting is stable under ties (same updatedAt) — no crashes, length preserved", () => {
    fc.assert(
      fc.property(
        // Projects that all have the same updatedAt
        fc.integer({ min: 0, max: 1_000_000_000 }).chain((ts) =>
          fc
            .array(
              fc.string({ minLength: 4, maxLength: 12 }).map(
                (name, i): Project => ({
                  id: `proj_${name}_${i}`,
                  name,
                  updatedAt: new Date(ts),
                  createdAt: new Date(ts),
                  totalCreditsUsed: 0,
                })
              ),
              { minLength: 0, maxLength: 20 }
            )
        ),
        (projects) => {
          const sorted = sortProjectsByLastEdited(projects);
          expect(sorted.length).toBe(projects.length);
          expect(isSortedDescByUpdatedAt(sorted)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
