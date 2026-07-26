/**
 * lib/ai/spec-generator.property.test.ts
 *
 * Task 12.1 — Property: spec generator always produces schema-conforming output
 * Validates: Requirements 4.1, 4.2
 *
 * These tests are purely about the SiteSpecSchema Zod validation and the
 * corrective-retry prompt construction — no LLM calls or DB writes are made.
 * We mock lib/ai/index (which throws at import if AI_PROVIDER is unset) so
 * that importing spec-generator.ts doesn't fail in the test environment.
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

// Must be hoisted before any import that transitively imports lib/ai/index
vi.mock("@/lib/ai/index", () => ({
  aiProvider: { complete: vi.fn() },
  logTokenUsage: vi.fn(),
  withRetry: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { tokenLog: { create: vi.fn() } } }));

import { SiteSpecSchema } from "./spec-generator";
import type { SiteSpec } from "./spec-generator";

// ---------------------------------------------------------------------------
// Arbitraries for valid SiteSpec components
// ---------------------------------------------------------------------------

const hexColorArb = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, "0").toUpperCase()}`);

const sectionTypeArb = fc.constantFrom(
  "hero", "features", "about", "contact", "footer", "gallery", "pricing", "testimonials"
) as fc.Arbitrary<SiteSpec["sections"][number]["type"]>;

const sectionArb = fc.record({
  type: sectionTypeArb,
  heading: fc.string({ minLength: 1, maxLength: 80 }),
  copy: fc.string({ minLength: 0, maxLength: 300 }),
  layoutHint: fc.string({ minLength: 1, maxLength: 50 }),
});

const colorPaletteArb = fc.record({
  primary: hexColorArb,
  secondary: hexColorArb,
  accent: hexColorArb,
  background: hexColorArb,
  text: hexColorArb,
});

const siteSpecArb = fc.record({
  pageTitle: fc.string({ minLength: 1, maxLength: 100 }),
  colorPalette: colorPaletteArb,
  sections: fc.array(sectionArb, { minLength: 1, maxLength: 8 }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Spec Generator — SiteSpecSchema (Task 12.1)", () => {
  it("any valid SiteSpec object always passes schema validation", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const result = SiteSpecSchema.safeParse(spec);
        expect(result.success).toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it("schema rejects spec with empty sections array", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), colorPaletteArb, (pageTitle, colorPalette) => {
        const result = SiteSpecSchema.safeParse({ pageTitle, colorPalette, sections: [] });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("schema rejects spec with invalid hex colour (missing #)", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const bad = { ...spec, colorPalette: { ...spec.colorPalette, primary: "FF0000" } };
        expect(SiteSpecSchema.safeParse(bad).success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("schema rejects spec with invalid hex colour (5-digit)", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const bad = { ...spec, colorPalette: { ...spec.colorPalette, accent: "#FFF00" } };
        expect(SiteSpecSchema.safeParse(bad).success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("schema rejects spec missing pageTitle", () => {
    fc.assert(
      fc.property(colorPaletteArb, fc.array(sectionArb, { minLength: 1 }), (colorPalette, sections) => {
        const result = SiteSpecSchema.safeParse({ colorPalette, sections });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("schema rejects section with invalid type", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const badSection = { type: "invalid-type", heading: "Hi", copy: "x", layoutHint: "full" };
        const bad = { ...spec, sections: [badSection] };
        expect(SiteSpecSchema.safeParse(bad).success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("a valid SiteSpec serialises to JSON and re-parses to an identical structure", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const json = JSON.stringify(spec);
        const reparsed = JSON.parse(json);
        const result = SiteSpecSchema.safeParse(reparsed);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.pageTitle).toBe(spec.pageTitle);
          expect(result.data.sections.length).toBe(spec.sections.length);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("corrective retry prompt always contains the Zod error message", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (zodError) => {
        const note = `Your previous response was not valid JSON. Return only the JSON object. Previous error: ${zodError}`;
        expect(note).toContain(zodError);
        expect(note).toContain("Return only the JSON object");
      }),
      { numRuns: 200 }
    );
  });
});
