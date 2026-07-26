/**
 * lib/ai/code-generator.property.test.ts
 *
 * Task 13.1 — Property: code generator LLM prompt always includes mobile-responsive instruction
 * Validates: Requirements 5.2
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/index", () => ({
  aiProvider: { complete: vi.fn() },
  logTokenUsage: vi.fn(),
  withRetry: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { tokenLog: { create: vi.fn() } } }));

import { buildCodeGenSystemPrompt } from "./code-generator";
import type { SiteSpec } from "./spec-generator";

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
  primary: hexColorArb,
  secondary: hexColorArb,
  accent: hexColorArb,
  background: hexColorArb,
  text: hexColorArb,
});

const siteSpecArb: fc.Arbitrary<SiteSpec> = fc.record({
  pageTitle: fc.string({ minLength: 1, maxLength: 100 }),
  colorPalette: colorPaletteArb,
  sections: fc.array(
    fc.record({
      type: sectionTypeArb,
      heading: fc.string({ minLength: 1, maxLength: 80 }),
      copy: fc.string({ minLength: 0, maxLength: 200 }),
      layoutHint: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    { minLength: 1, maxLength: 8 }
  ),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Code Generator — system prompt invariants (Task 13.1)", () => {
  it("system prompt always contains '320px' mobile-responsive instruction", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildCodeGenSystemPrompt(spec);
        expect(prompt).toContain("320px");
      }),
      { numRuns: 300 }
    );
  });

  it("system prompt always contains 'mobile' responsive instruction", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildCodeGenSystemPrompt(spec);
        expect(prompt.toLowerCase()).toContain("mobile");
      }),
      { numRuns: 300 }
    );
  });

  it("system prompt always contains 'HTML5' validity instruction", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildCodeGenSystemPrompt(spec);
        expect(prompt).toContain("HTML5");
      }),
      { numRuns: 300 }
    );
  });

  it("system prompt always includes all 5 hex color values from the colorPalette", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildCodeGenSystemPrompt(spec);
        const { primary, secondary, accent, background, text } = spec.colorPalette;
        expect(prompt).toContain(primary);
        expect(prompt).toContain(secondary);
        expect(prompt).toContain(accent);
        expect(prompt).toContain(background);
        expect(prompt).toContain(text);
      }),
      { numRuns: 300 }
    );
  });

  it("system prompt always includes the page title", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildCodeGenSystemPrompt(spec);
        expect(prompt).toContain(spec.pageTitle);
      }),
      { numRuns: 300 }
    );
  });

  it("system prompt always contains a self-contained single-file instruction", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildCodeGenSystemPrompt(spec);
        const hasInstruction =
          prompt.toLowerCase().includes("self-contained") ||
          prompt.toLowerCase().includes("single") ||
          prompt.toLowerCase().includes("one file");
        expect(hasInstruction).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("system prompt is always a non-empty string for any SiteSpec", () => {
    fc.assert(
      fc.property(siteSpecArb, (spec) => {
        const prompt = buildCodeGenSystemPrompt(spec);
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });
});
