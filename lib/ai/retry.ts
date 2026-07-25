/**
 * lib/ai/retry.ts
 *
 * withRetry — wraps an async function with exponential-backoff retries and a
 * per-attempt timeout.
 *
 * Behaviour (matches design.md §Retry and Timeout Logic):
 *   - Up to `attempts` total attempts (default 3).
 *   - Each attempt races the fn against a 60-second timeout.
 *   - On failure the delay starts at 1 s and doubles each time, capped at 16 s.
 *   - After the final attempt the error is re-thrown.
 *
 * Requirements: 14.2, 14.3
 */

// ---------------------------------------------------------------------------
// Helpers (exported so property tests can use them directly)
// ---------------------------------------------------------------------------

/** Returns a promise that rejects after `ms` milliseconds with a TimeoutError. */
export function createTimeout(ms: number): Promise<never> {
  return new Promise<never>((_, reject) =>
    setTimeout(() => reject(new TimeoutError(`Operation timed out after ${ms}ms`)), ms)
  );
}

/** Resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Computes the backoff delay for a given attempt index (0-based). */
export function backoffDelay(attempt: number, initialDelay = 1000, maxDelay = 16_000): number {
  return Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
}

// ---------------------------------------------------------------------------
// Custom error type
// ---------------------------------------------------------------------------

export class TimeoutError extends Error {
  readonly isTimeout = true;

  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Main implementation
// ---------------------------------------------------------------------------

/**
 * withRetry
 *
 * Calls `fn()` up to `attempts` times.  Each call races against a 60-second
 * timeout.  On failure (including timeout), sleeps for the next backoff
 * interval before retrying.  Throws after the last attempt.
 *
 * @param fn       Async function to call.
 * @param attempts Total number of attempts (default 3).
 * @param timeoutMs Per-attempt timeout in milliseconds (default 60 000).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  timeoutMs = 60_000
): Promise<T> {
  let delay = 1000; // initial backoff delay

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await Promise.race([fn(), createTimeout(timeoutMs)]);
    } catch (err) {
      if (attempt === attempts - 1) {
        // Last attempt — propagate the error.
        throw err;
      }
      await sleep(Math.min(delay, 16_000));
      delay *= 2;
    }
  }

  // This line is unreachable because either we return or throw above,
  // but TypeScript requires an explicit throw/return here.
  throw new Error("Max retries exceeded");
}
