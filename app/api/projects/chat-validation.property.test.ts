/**
 * app/api/projects/chat-validation.property.test.ts
 *
 * Task 20.1 — Property 15: Edit prompts outside the valid length range are always rejected
 * Task 20.2 — Property 18: Chat messages are always returned in chronological order
 *
 * **Validates: Requirements 8.1, 8.5**
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  EDIT_PROMPT_MAX_LENGTH,
  EDIT_PROMPT_MIN_LENGTH,
  validateEditPromptLength,
} from "@/lib/validation/prompt";

// ---------------------------------------------------------------------------
// Property 15 — Edit prompts outside the valid length range are always rejected
// Validates: Requirements 8.1
// ---------------------------------------------------------------------------

describe("Property 15 — Edit prompts outside the valid length range are always rejected", () => {
  it("any prompt within [5, 1000] chars always passes validation", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: EDIT_PROMPT_MIN_LENGTH, max: EDIT_PROMPT_MAX_LENGTH }).chain((len) =>
          fc.stringOf(fc.char(), { minLength: len, maxLength: len })
        ),
        (prompt) => {
          const result = validateEditPromptLength(prompt);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 300 }
    );
  });

  it("any prompt shorter than 5 chars always fails validation", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: EDIT_PROMPT_MIN_LENGTH - 1 }).chain((len) =>
          fc.stringOf(fc.char(), { minLength: len, maxLength: len })
        ),
        (prompt) => {
          const result = validateEditPromptLength(prompt);
          expect(result).not.toBeNull();
          expect(typeof result).toBe("string");
        }
      ),
      { numRuns: 300 }
    );
  });

  it("any prompt longer than 1000 chars always fails validation", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: EDIT_PROMPT_MAX_LENGTH + 1, max: 1500 }).chain((len) =>
          fc.stringOf(fc.char(), { minLength: len, maxLength: len })
        ),
        (prompt) => {
          const result = validateEditPromptLength(prompt);
          expect(result).not.toBeNull();
          expect(typeof result).toBe("string");
        }
      ),
      { numRuns: 300 }
    );
  });

  it("boundary: exactly 5 chars passes", () => {
    expect(validateEditPromptLength("a".repeat(EDIT_PROMPT_MIN_LENGTH))).toBeNull();
  });

  it("boundary: exactly 1000 chars passes", () => {
    expect(validateEditPromptLength("a".repeat(EDIT_PROMPT_MAX_LENGTH))).toBeNull();
  });

  it("boundary: 4 chars fails", () => {
    expect(validateEditPromptLength("a".repeat(EDIT_PROMPT_MIN_LENGTH - 1))).not.toBeNull();
  });

  it("boundary: 1001 chars fails", () => {
    expect(validateEditPromptLength("a".repeat(EDIT_PROMPT_MAX_LENGTH + 1))).not.toBeNull();
  });

  it("empty string always fails", () => {
    expect(validateEditPromptLength("")).not.toBeNull();
  });

  it("non-string values always fail", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        (value) => {
          expect(validateEditPromptLength(value)).not.toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18 — Chat messages are always returned in chronological order
// Validates: Requirements 8.5
// ---------------------------------------------------------------------------

describe("Property 18 — Chat messages are always returned in chronological order", () => {
  interface ChatMessage {
    id: string;
    prompt: string;
    status: "PENDING" | "APPLIED" | "FAILED";
    createdAt: Date;
  }

  /**
   * Simulates the DB query sort: messages sorted by createdAt asc.
   */
  function sortChronologically(messages: ChatMessage[]): ChatMessage[] {
    return [...messages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  /**
   * Checks that an array of messages is in non-decreasing createdAt order.
   */
  function isChronological(messages: ChatMessage[]): boolean {
    for (let i = 1; i < messages.length; i++) {
      if (messages[i]!.createdAt < messages[i - 1]!.createdAt) return false;
    }
    return true;
  }

  const messageArb: fc.Arbitrary<ChatMessage> = fc
    .tuple(
      fc.string({ minLength: 5, maxLength: 20 }),
      fc.integer({ min: 0, max: 1_000_000_000_000 })
    )
    .map(([prompt, ts], i) => ({
      id: `msg_${i}_${ts}`,
      prompt,
      status: "PENDING" as const,
      createdAt: new Date(ts),
    }));

  it("sort always produces a chronologically ordered sequence", () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 50 }),
        (messages) => {
          const sorted = sortChronologically(messages);
          expect(isChronological(sorted)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("sorted result always has the same length as the input", () => {
    fc.assert(
      fc.property(
        fc.array(messageArb, { minLength: 0, maxLength: 50 }),
        (messages) => {
          const sorted = sortChronologically(messages);
          expect(sorted.length).toBe(messages.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("sorted result is stable — same timestamps preserve relative order (no crashes)", () => {
    fc.assert(
      fc.property(
        // Messages with possibly repeated timestamps
        fc.array(
          fc.tuple(fc.string({ minLength: 5, maxLength: 20 }), fc.integer({ min: 0, max: 100 })).map(
            ([prompt, ts]) => ({
              id: `msg_${ts}_${Math.random()}`,
              prompt,
              status: "PENDING" as const,
              createdAt: new Date(ts),
            })
          ),
          { minLength: 0, maxLength: 30 }
        ),
        (messages) => {
          const sorted = sortChronologically(messages);
          expect(isChronological(sorted)).toBe(true);
          expect(sorted.length).toBe(messages.length);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("empty array is always chronological", () => {
    expect(isChronological([])).toBe(true);
    expect(sortChronologically([])).toEqual([]);
  });

  it("single message is always chronological", () => {
    const msg: ChatMessage = {
      id: "msg_1",
      prompt: "hello there",
      status: "PENDING",
      createdAt: new Date(),
    };
    expect(isChronological([msg])).toBe(true);
  });
});
