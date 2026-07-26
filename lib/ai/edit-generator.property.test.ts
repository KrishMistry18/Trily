/**
 * lib/ai/edit-generator.property.test.ts
 *
 * Task 14.1 — Property 16: Edit jobs always include current code in the LLM prompt
 * Validates: Requirements 8.3
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/index", () => ({
  aiProvider: { complete: vi.fn() },
  logTokenUsage: vi.fn(),
  withRetry: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { tokenLog: { create: vi.fn() } } }));

import { buildEditUserPrompt } from "./edit-generator";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const htmlArb = fc.oneof(
  fc.constant(""),
  fc.constant("<!DOCTYPE html><html><body><h1>Hello</h1></body></html>"),
  fc.string({ minLength: 0, maxLength: 2000 }),
);

const editPromptArb = fc.string({ minLength: 5, maxLength: 1000 });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Edit Generator — prompt invariants (Task 14.1 — Property 16)", () => {
  it("user prompt always contains the full currentHtml string", () => {
    fc.assert(
      fc.property(htmlArb, editPromptArb, (currentHtml, editPrompt) => {
        const prompt = buildEditUserPrompt(currentHtml, editPrompt);
        expect(prompt).toContain(currentHtml);
      }),
      { numRuns: 300 }
    );
  });

  it("user prompt always contains the editPrompt string", () => {
    fc.assert(
      fc.property(htmlArb, editPromptArb, (currentHtml, editPrompt) => {
        const prompt = buildEditUserPrompt(currentHtml, editPrompt);
        expect(prompt).toContain(editPrompt);
      }),
      { numRuns: 300 }
    );
  });

  it("empty currentHtml is still embedded — CURRENT HTML: marker always appears", () => {
    fc.assert(
      fc.property(editPromptArb, (editPrompt) => {
        const prompt = buildEditUserPrompt("", editPrompt);
        expect(prompt).toContain("CURRENT HTML:");
        expect(prompt).toContain("EDIT INSTRUCTION:");
        expect(prompt).toContain(editPrompt);
      }),
      { numRuns: 200 }
    );
  });

  it("currentHtml appears BEFORE editPrompt in the prompt", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 5, maxLength: 200 }),
        (currentHtml, editPrompt) => {
          fc.pre(!currentHtml.includes(editPrompt) && !editPrompt.includes(currentHtml));
          const prompt = buildEditUserPrompt(currentHtml, editPrompt);
          const htmlIdx = prompt.indexOf(currentHtml);
          const editIdx = prompt.indexOf(editPrompt);
          expect(htmlIdx).toBeGreaterThanOrEqual(0);
          expect(editIdx).toBeGreaterThanOrEqual(0);
          expect(htmlIdx).toBeLessThan(editIdx);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("prompt always contains both CURRENT HTML: and EDIT INSTRUCTION: markers", () => {
    fc.assert(
      fc.property(htmlArb, editPromptArb, (currentHtml, editPrompt) => {
        const prompt = buildEditUserPrompt(currentHtml, editPrompt);
        expect(prompt).toContain("CURRENT HTML:");
        expect(prompt).toContain("EDIT INSTRUCTION:");
      }),
      { numRuns: 200 }
    );
  });

  it("prompt is always a non-empty string", () => {
    fc.assert(
      fc.property(htmlArb, editPromptArb, (currentHtml, editPrompt) => {
        const prompt = buildEditUserPrompt(currentHtml, editPrompt);
        expect(typeof prompt).toBe("string");
        expect(prompt.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });
});
