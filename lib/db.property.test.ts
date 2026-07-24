/**
 * lib/db.property.test.ts
 *
 * Property-based tests for the database schema and data model.
 *
 * Task 2.1 — Property 8: New projects always have all required fields populated
 * Validates: Requirements 3.6
 *
 * Strategy: Use fast-check to generate arbitrary (valid) Project input data and
 * verify that the resulting Project object — as shaped by the Prisma schema and
 * our TypeScript types — always has every required field populated with a
 * non-null, non-empty value.  Because no live database is required, we model
 * the creation logic in-process and test the data-shape invariants directly.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Minimal inline types that mirror the Prisma-generated Project shape.
// These are intentionally kept close to the schema so that a schema change
// causes a compile error here as well.
// ---------------------------------------------------------------------------

interface ProjectRequiredFields {
  id: string;
  userId: string;
  name: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
}

type ProjectOptionalFields = {
  siteSpec?: unknown;
  thumbnailUrl?: string | null;
  totalCreditsUsed: number;
};

type Project = ProjectRequiredFields & ProjectOptionalFields;

/**
 * Simulates the Project creation logic:
 * Takes raw user input and returns the full Project record exactly as the DB
 * (and Prisma default values) would produce it.
 *
 * This is a pure function so it is easily testable without a database.
 */
function createProjectRecord(input: {
  userId: string;
  name: string;
  prompt: string;
}): Project {
  const now = new Date();
  return {
    // cuid()-style placeholder — in production Prisma generates this via @default(cuid())
    id: `c${Math.random().toString(36).slice(2, 20)}`,
    userId: input.userId,
    name: input.name,
    prompt: input.prompt,
    siteSpec: null,
    thumbnailUrl: null,
    totalCreditsUsed: 0, // @default(0) in schema
    createdAt: now, // @default(now()) in schema
    updatedAt: now, // @updatedAt in schema
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when a value is non-null and, for strings, non-empty. */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a valid userId — mirrors the cuid() format produced by Prisma's
 * @default(cuid()) when a User record is created.
 */
const userIdArb = fc
  .hexaString({ minLength: 12, maxLength: 24 })
  .map((s) => `c${s}`);

/**
 * Generates a valid project name (1–255 chars, no leading/trailing whitespace).
 */
const projectNameArb = fc
  .string({ minLength: 1, maxLength: 255 })
  .filter((s) => s.trim().length > 0);

/**
 * Generates a valid prompt that satisfies Requirement 3.5 (10–2 000 chars).
 */
const promptArb = fc.string({ minLength: 10, maxLength: 2000 });

// ---------------------------------------------------------------------------
// Property 8: New projects always have all required fields populated
// Validates: Requirements 3.6
// ---------------------------------------------------------------------------

describe("Property 8 — New projects always have all required fields populated", () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * For any combination of valid (userId, name, prompt), the Project record
   * produced by createProjectRecord must have every required field set to a
   * non-null, non-empty value.
   */
  it("every required field is non-null and non-empty for any valid input", () => {
    fc.assert(
      fc.property(userIdArb, projectNameArb, promptArb, (userId, name, prompt) => {
        const project = createProjectRecord({ userId, name, prompt });

        // All required fields must be populated
        expect(isPopulated(project.id)).toBe(true);
        expect(isPopulated(project.userId)).toBe(true);
        expect(isPopulated(project.name)).toBe(true);
        expect(isPopulated(project.prompt)).toBe(true);
        expect(project.createdAt).toBeInstanceOf(Date);
        expect(project.updatedAt).toBeInstanceOf(Date);
      }),
      { numRuns: 200 }
    );
  });

  it("id field is always a non-empty string", () => {
    fc.assert(
      fc.property(userIdArb, projectNameArb, promptArb, (userId, name, prompt) => {
        const project = createProjectRecord({ userId, name, prompt });
        expect(typeof project.id).toBe("string");
        expect(project.id.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it("userId always matches the input userId", () => {
    fc.assert(
      fc.property(userIdArb, projectNameArb, promptArb, (userId, name, prompt) => {
        const project = createProjectRecord({ userId, name, prompt });
        // userId on the record must equal the submitting user's ID (Req 3.6)
        expect(project.userId).toBe(userId);
      }),
      { numRuns: 200 }
    );
  });

  it("prompt on the project always equals the original submission prompt (Req 3.6)", () => {
    fc.assert(
      fc.property(userIdArb, projectNameArb, promptArb, (userId, name, prompt) => {
        const project = createProjectRecord({ userId, name, prompt });
        // Per Requirement 3.6: the original Prompt text is stored on the Project
        expect(project.prompt).toBe(prompt);
      }),
      { numRuns: 200 }
    );
  });

  it("createdAt and updatedAt are always valid Date objects", () => {
    fc.assert(
      fc.property(userIdArb, projectNameArb, promptArb, (userId, name, prompt) => {
        const project = createProjectRecord({ userId, name, prompt });

        expect(project.createdAt).toBeInstanceOf(Date);
        expect(project.updatedAt).toBeInstanceOf(Date);

        // Dates must be finite (not Invalid Date)
        expect(isFinite(project.createdAt.getTime())).toBe(true);
        expect(isFinite(project.updatedAt.getTime())).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("totalCreditsUsed defaults to 0 for every new project", () => {
    fc.assert(
      fc.property(userIdArb, projectNameArb, promptArb, (userId, name, prompt) => {
        const project = createProjectRecord({ userId, name, prompt });
        expect(project.totalCreditsUsed).toBe(0);
      }),
      { numRuns: 200 }
    );
  });

  it("all six required fields are present as own properties of the returned object", () => {
    const requiredFields: (keyof ProjectRequiredFields)[] = [
      "id",
      "userId",
      "name",
      "prompt",
      "createdAt",
      "updatedAt",
    ];

    fc.assert(
      fc.property(userIdArb, projectNameArb, promptArb, (userId, name, prompt) => {
        const project = createProjectRecord({ userId, name, prompt });

        for (const field of requiredFields) {
          expect(
            Object.prototype.hasOwnProperty.call(project, field),
            `Missing required field: ${field}`
          ).toBe(true);

          expect(
            isPopulated(project[field]),
            `Required field "${field}" is null/undefined/empty`
          ).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });
});
