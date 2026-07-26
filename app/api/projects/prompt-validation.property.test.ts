/**
 * app/api/projects/prompt-validation.property.test.ts
 *
 * Task 18.1 — Property 7: Prompt length validation is enforced consistently
 *
 * For any prompt with length < 10 or > 2000, validation always returns an error.
 * For any prompt with 10 ≤ length ≤ 2000, validation passes (returns null).
 *
 * **Validates: Requirements 3.5**
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  PROMPT_MAX_LENGTH,
  PROMPT_MIN_LENGTH,
  validatePromptLength,
} from "@/lib/validation/prompt";

// ---------------------------------------------------------------------------
// Property 7: Prompt length validation is enforced consistently
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------

describe("Property 7 — Prompt length validation is enforced consistently", () => {
  // -----------------------------------------------------------------------
  // Valid prompts (10 ≤ length ≤ 2000) must always pass (return null)
  // -----------------------------------------------------------------------

  it("any prompt within [10, 2000] chars always passes validation", () => {
    fc.assert(
      fc.property(
        // Generate strings of exactly length between 10 and 2000
        fc.integer({ min: PROMPT_MIN_LENGTH, max: PROMPT_MAX_LENGTH }).chain((len) =>
          fc.stringOf(fc.char(), { minLength: len, maxLength: len })
        ),
        (prompt) => {
          expect(prompt.length).toBeGreaterThanOrEqual(PROMPT_MIN_LENGTH);
          expect(prompt.length).toBeLessThanOrEqual(PROMPT_MAX_LENGTH);
          const result = validatePromptLength(prompt);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 300 }
    );
  });

  // -----------------------------------------------------------------------
  // Too-short prompts (length < 10) must always be rejected
  // -----------------------------------------------------------------------

  it("any prompt shorter than 10 chars always fails validation", () => {
    fc.assert(
      fc.property(
        // Generate strings of length 0 to 9
        fc.integer({ min: 0, max: PROMPT_MIN_LENGTH - 1 }).chain((len) =>
          fc.stringOf(fc.char(), { minLength: len, maxLength: len })
        ),
        (prompt) => {
          expect(prompt.length).toBeLessThan(PROMPT_MIN_LENGTH);
          const result = validatePromptLength(prompt);
          expect(result).not.toBeNull();
          expect(typeof result).toBe("string");
        }
      ),
      { numRuns: 300 }
    );
  });

  // -----------------------------------------------------------------------
  // Too-long prompts (length > 2000) must always be rejected
  // -----------------------------------------------------------------------

  it("any prompt longer than 2000 chars always fails validation", () => {
    fc.assert(
      fc.property(
        // Generate strings of length 2001 to 3000
        fc.integer({ min: PROMPT_MAX_LENGTH + 1, max: 3000 }).chain((len) =>
          fc.stringOf(fc.char(), { minLength: len, maxLength: len })
        ),
        (prompt) => {
          expect(prompt.length).toBeGreaterThan(PROMPT_MAX_LENGTH);
          const result = validatePromptLength(prompt);
          expect(result).not.toBeNull();
          expect(typeof result).toBe("string");
        }
      ),
      { numRuns: 300 }
    );
  });

  // -----------------------------------------------------------------------
  // Boundary values
  // -----------------------------------------------------------------------

  it("exact boundary: prompt of exactly 10 chars passes", () => {
    const prompt = "a".repeat(PROMPT_MIN_LENGTH);
    expect(validatePromptLength(prompt)).toBeNull();
  });

  it("exact boundary: prompt of exactly 2000 chars passes", () => {
    const prompt = "a".repeat(PROMPT_MAX_LENGTH);
    expect(validatePromptLength(prompt)).toBeNull();
  });

  it("exact boundary: prompt of 9 chars fails", () => {
    const prompt = "a".repeat(PROMPT_MIN_LENGTH - 1);
    expect(validatePromptLength(prompt)).not.toBeNull();
  });

  it("exact boundary: prompt of 2001 chars fails", () => {
    const prompt = "a".repeat(PROMPT_MAX_LENGTH + 1);
    expect(validatePromptLength(prompt)).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Non-string inputs always fail
  // -----------------------------------------------------------------------

  it("non-string values always fail validation", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        (value) => {
          const result = validatePromptLength(value);
          expect(result).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  // -----------------------------------------------------------------------
  // Empty string always fails
  // -----------------------------------------------------------------------

  it("empty string always fails validation", () => {
    expect(validatePromptLength("")).not.toBeNull();
  });
});
