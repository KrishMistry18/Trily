/**
 * lib/validation/prompt.ts
 *
 * Pure prompt-length validation helpers.
 * Kept separate from route handlers so property tests can import them
 * without pulling in Next.js / NextAuth dependencies.
 *
 * Requirements: 3.5, 8.1
 */

// ---------------------------------------------------------------------------
// Project creation prompt constraints (Requirement 3.5)
// ---------------------------------------------------------------------------

export const PROMPT_MIN_LENGTH = 10;
export const PROMPT_MAX_LENGTH = 2000;

/**
 * Validates a project creation prompt.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePromptLength(prompt: unknown): string | null {
  if (typeof prompt !== "string") return "prompt must be a string";
  if (prompt.length < PROMPT_MIN_LENGTH)
    return `prompt must be at least ${PROMPT_MIN_LENGTH} characters`;
  if (prompt.length > PROMPT_MAX_LENGTH)
    return `prompt must be at most ${PROMPT_MAX_LENGTH} characters`;
  return null;
}

// ---------------------------------------------------------------------------
// Edit prompt constraints (Requirement 8.1)
// ---------------------------------------------------------------------------

export const EDIT_PROMPT_MIN_LENGTH = 5;
export const EDIT_PROMPT_MAX_LENGTH = 1000;

/**
 * Validates an edit (chat) prompt.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateEditPromptLength(prompt: unknown): string | null {
  if (typeof prompt !== "string") return "prompt must be a string";
  if (prompt.length < EDIT_PROMPT_MIN_LENGTH)
    return `prompt must be at least ${EDIT_PROMPT_MIN_LENGTH} characters`;
  if (prompt.length > EDIT_PROMPT_MAX_LENGTH)
    return `prompt must be at most ${EDIT_PROMPT_MAX_LENGTH} characters`;
  return null;
}
