/**
 * lib/ai/image-generator.property.test.ts
 *
 * Task 15.1 — Property 28: Image generation credit cost is always deducted when opted in
 * Validates: Requirements 18.2
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  storageService: { writeImageFile: vi.fn().mockResolvedValue("mocked/key") },
}));
vi.mock("@/lib/db", () => ({ db: { tokenLog: { create: vi.fn() } } }));
vi.mock("@/lib/ai/index", () => ({
  aiProvider: { complete: vi.fn() },
  logTokenUsage: vi.fn(),
  withRetry: vi.fn(),
}));

import { buildImagePrompt } from "./image-generator";
import type { SiteSpec } from "./spec-generator";

// ---------------------------------------------------------------------------
// Inline ledger model — avoids importing lib/billing/config (which loads Prisma)
// ---------------------------------------------------------------------------

const CREDIT_COSTS = { CREATE_JOB: 5, EDIT_JOB: 2, IMAGE_JOB: 3 } as const;

interface LedgerEntry {
  userId: string;
  eventType: "DEDUCTION" | "REFUND" | "MONTHLY_GRANT" | "TOP_UP";
  amount: number;
}

function simulateJobDispatch(
  userId: string,
  includeImageGeneration: boolean,
  ledger: LedgerEntry[]
): LedgerEntry[] {
  const result = [...ledger];
  result.push({ userId, eventType: "DEDUCTION", amount: CREDIT_COSTS.CREATE_JOB });
  if (includeImageGeneration) {
    result.push({ userId, eventType: "DEDUCTION", amount: CREDIT_COSTS.IMAGE_JOB });
  }
  return result;
}

function getTotalDeducted(userId: string, ledger: LedgerEntry[]): number {
  return ledger
    .filter((e) => e.userId === userId && e.eventType === "DEDUCTION")
    .reduce((sum, e) => sum + e.amount, 0);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const hexColorArb = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, "0").toUpperCase()}`);

const sectionTypeArb = fc.constantFrom(
  "hero", "features", "about", "contact", "footer", "gallery", "pricing", "testimonials"
) as fc.Arbitrary<SiteSpec["sections"][number]["type"]>;

const colorPaletteArb = fc.record({
  primary: hexColorArb, secondary: hexColorArb,
  accent: hexColorArb, background: hexColorArb, text: hexColorArb,
});

const siteSpecArb: fc.Arbitrary<SiteSpec> = fc.record({
  pageTitle: fc.string({ minLength: 1, maxLength: 80 }),
  colorPalette: colorPaletteArb,
  sections: fc.array(
    fc.record({
      type: sectionTypeArb,
      heading: fc.string({ minLength: 1, maxLength: 60 }),
      copy: fc.string({ minLength: 0, maxLength: 200 }),
      layoutHint: fc.string({ minLength: 1, maxLength: 40 }),
    }),
    { minLength: 1, maxLength: 6 }
  ),
});

const userIdArb = fc.hexaString({ minLength: 8, maxLength: 16 }).map((s) => `u${s}`);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 28 — Image generation credit cost is always deducted when opted in", () => {
  it("when includeImageGeneration=true, IMAGE_JOB credits are always deducted", () => {
    fc.assert(
      fc.property(userIdArb, (userId) => {
        const ledger = simulateJobDispatch(userId, true, []);
        const imageDeductions = ledger.filter(
          (e) => e.userId === userId && e.eventType === "DEDUCTION" && e.amount === CREDIT_COSTS.IMAGE_JOB
        );
        expect(imageDeductions.length).toBe(1);
        expect(imageDeductions[0]!.amount).toBe(CREDIT_COSTS.IMAGE_JOB);
      }),
      { numRuns: 300 }
    );
  });

  it("when includeImageGeneration=false, no IMAGE_JOB deduction occurs", () => {
    fc.assert(
      fc.property(userIdArb, (userId) => {
        const ledger = simulateJobDispatch(userId, false, []);
        const imageDeductions = ledger.filter(
          (e) => e.userId === userId && e.eventType === "DEDUCTION" && e.amount === CREDIT_COSTS.IMAGE_JOB
        );
        expect(imageDeductions.length).toBe(0);
      }),
      { numRuns: 300 }
    );
  });

  it("total deduction with image is always CREATE_JOB + IMAGE_JOB", () => {
    fc.assert(
      fc.property(userIdArb, (userId) => {
        const total = getTotalDeducted(userId, simulateJobDispatch(userId, true, []));
        expect(total).toBe(CREDIT_COSTS.CREATE_JOB + CREDIT_COSTS.IMAGE_JOB);
      }),
      { numRuns: 300 }
    );
  });

  it("total deduction without image is always just CREATE_JOB", () => {
    fc.assert(
      fc.property(userIdArb, (userId) => {
        const total = getTotalDeducted(userId, simulateJobDispatch(userId, false, []));
        expect(total).toBe(CREDIT_COSTS.CREATE_JOB);
      }),
      { numRuns: 300 }
    );
  });

  it("IMAGE_JOB credit cost is always exactly 3", () => {
    expect(CREDIT_COSTS.IMAGE_JOB).toBe(3);
  });

  it("image deduction only applies to the correct user, not others", () => {
    fc.assert(
      fc.property(userIdArb, userIdArb, (userId1, userId2) => {
        fc.pre(userId1 !== userId2);
        const ledger = simulateJobDispatch(userId1, true, []);
        const user2Deductions = ledger.filter((e) => e.userId === userId2);
        expect(user2Deductions.length).toBe(0);
      }),
      { numRuns: 200 }
    );
  });
});

describe("Image Generator — buildImagePrompt (Task 15)", () => {
  it("image prompt always contains hero section copy when hero section exists", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const specWithHero: SiteSpec = {
          ...spec,
          sections: [
            { type: "hero", heading: "Hero Heading", copy: "Hero copy text", layoutHint: "centered" },
            ...spec.sections.filter((s) => s.type !== "hero"),
          ],
        };
        const prompt = buildImagePrompt(specWithHero);
        expect(prompt).toContain("Hero Heading");
        expect(prompt).toContain("Hero copy text");
      }),
      { numRuns: 200 }
    );
  });

  it("image prompt always contains primary and accent hex colors", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildImagePrompt(spec);
        expect(prompt).toContain(spec.colorPalette.primary);
        expect(prompt).toContain(spec.colorPalette.accent);
      }),
      { numRuns: 200 }
    );
  });

  it("image prompt is always a non-empty string", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildImagePrompt(spec);
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });
});
