/**
 * lib/rate-limit/rate-limit.property.test.ts
 *
 * Property 26: Rate limiter always rejects requests exceeding the configured limit
 * Validates: Requirements 15.1, 15.2
 *
 * Tests the pure sliding-window rate-limit logic in-process (no live Redis).
 * The algorithm is modelled as operations on an in-memory sorted array of
 * timestamps, mirroring what Redis ZADD / ZREMRANGEBYSCORE would do.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure in-memory implementation of the sliding-window algorithm
// ---------------------------------------------------------------------------

interface PureRateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Pure sliding-window rate-limit check operating on an array of timestamps
 * (equivalent to a Redis sorted set keyed by score = timestamp).
 *
 * @param timestamps  Existing request timestamps within or potentially outside the window.
 * @param now         The current timestamp (ms since epoch).
 * @param windowMs    The length of the sliding window in milliseconds.
 * @param maxRequests The maximum number of requests allowed per window.
 * @returns           The rate-limit result and the updated timestamps array.
 */
function slidingWindowCheck(
  timestamps: number[],
  now: number,
  windowMs: number,
  maxRequests: number
): { result: PureRateLimitResult; updatedTimestamps: number[] } {
  const windowStart = now - windowMs;

  // Remove entries older than windowStart (ZREMRANGEBYSCORE equivalent).
  const inWindow = timestamps.filter((ts) => ts > windowStart);

  const count = inWindow.length;

  if (count >= maxRequests) {
    // retryAfterMs: time until the oldest entry in the window expires.
    const oldestScore = inWindow.length > 0 ? Math.min(...inWindow) : now;
    const retryAfterMs = Math.max(0, oldestScore + windowMs - now);
    return {
      result: { allowed: false, retryAfterMs },
      updatedTimestamps: inWindow,
    };
  }

  // Under the limit — record this request.
  const updatedTimestamps = [...inWindow, now];
  return {
    result: { allowed: true, retryAfterMs: 0 },
    updatedTimestamps,
  };
}

/**
 * Simulates multiple sequential requests using the pure sliding-window
 * algorithm and returns results for each request.
 *
 * @param requestCount  Number of requests to simulate.
 * @param now           Starting timestamp.
 * @param windowMs      Window length in ms.
 * @param maxRequests   Max allowed requests per window.
 */
function simulateRequests(
  requestCount: number,
  now: number,
  windowMs: number,
  maxRequests: number
): PureRateLimitResult[] {
  const results: PureRateLimitResult[] = [];
  let timestamps: number[] = [];

  for (let i = 0; i < requestCount; i++) {
    // Simulate a small time increment between requests (1ms) to get unique
    // timestamps without advancing past the window.
    const requestTime = now + i;
    const { result, updatedTimestamps } = slidingWindowCheck(
      timestamps,
      requestTime,
      windowMs,
      maxRequests
    );
    results.push(result);
    timestamps = updatedTimestamps;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Rate limiter — sliding window algorithm (Property 26)", () => {
  /**
   * Property 26a: When requestCount > maxRequests, at least one request
   * beyond the limit must be rejected (allowed: false).
   *
   * Validates: Requirements 15.1, 15.2
   */
  it(
    "Property 26a: requests exceeding maxRequests are always rejected",
    () => {
      fc.assert(
        fc.property(
          // maxRequests: 1..20
          fc.integer({ min: 1, max: 20 }),
          // extra requests beyond the limit: 1..10
          fc.integer({ min: 1, max: 10 }),
          // windowMs: 1000ms..60000ms
          fc.integer({ min: 1000, max: 60_000 }),
          (maxRequests, extraRequests, windowMs) => {
            const requestCount = maxRequests + extraRequests;
            const now = 1_000_000; // fixed reference point

            const results = simulateRequests(
              requestCount,
              now,
              windowMs,
              maxRequests
            );

            // The first `maxRequests` requests must all be allowed.
            for (let i = 0; i < maxRequests; i++) {
              const r = results[i];
              expect(r).toBeDefined();
              expect(r!.allowed).toBe(true);
            }

            // Requests beyond the limit must all be rejected.
            for (let i = maxRequests; i < requestCount; i++) {
              const r = results[i];
              expect(r).toBeDefined();
              expect(r!.allowed).toBe(false);
            }
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  /**
   * Property 26b: When requestCount <= maxRequests, all requests are allowed.
   *
   * Validates: Requirements 15.1, 15.2
   */
  it(
    "Property 26b: requests within the limit are always allowed",
    () => {
      fc.assert(
        fc.property(
          // maxRequests: 1..50
          fc.integer({ min: 1, max: 50 }),
          // requestCount: 1..maxRequests
          fc.integer({ min: 1, max: 50 }),
          // windowMs: 1000ms..60000ms
          fc.integer({ min: 1000, max: 60_000 }),
          (maxRequests, requestCountRaw, windowMs) => {
            // Ensure requestCount <= maxRequests
            const requestCount = Math.min(requestCountRaw, maxRequests);
            const now = 1_000_000;

            const results = simulateRequests(
              requestCount,
              now,
              windowMs,
              maxRequests
            );

            for (const result of results) {
              expect(result.allowed).toBe(true);
            }
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  /**
   * Property 26c: retryAfterMs is always >= 0 for any result.
   *
   * Validates: Requirements 15.3
   */
  it(
    "Property 26c: retryAfterMs is always non-negative",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 1000, max: 60_000 }),
          (maxRequests, requestCount, windowMs) => {
            const now = 1_000_000;

            const results = simulateRequests(
              requestCount,
              now,
              windowMs,
              maxRequests
            );

            for (const result of results) {
              expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  /**
   * Property 26d: retryAfterMs is always 0 when allowed is true.
   *
   * Validates: Requirements 15.3, 15.4
   */
  it(
    "Property 26d: retryAfterMs is 0 when the request is allowed",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 1000, max: 60_000 }),
          (maxRequests, windowMs) => {
            const now = 1_000_000;

            // Only simulate up to maxRequests to guarantee all are allowed.
            const results = simulateRequests(
              maxRequests,
              now,
              windowMs,
              maxRequests
            );

            for (const result of results) {
              expect(result.allowed).toBe(true);
              expect(result.retryAfterMs).toBe(0);
            }
          }
        ),
        { numRuns: 200 }
      );
    }
  );

  /**
   * Property 26e: Requests outside the window are not counted.
   * After waiting longer than windowMs, the window resets and requests are
   * allowed again.
   *
   * Validates: Requirements 15.2
   */
  it(
    "Property 26e: requests outside the window are not counted against the limit",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1000, max: 60_000 }),
          (maxRequests, windowMs) => {
            const now = 1_000_000;

            // Fill the window completely.
            let timestamps: number[] = [];
            for (let i = 0; i < maxRequests; i++) {
              const { updatedTimestamps } = slidingWindowCheck(
                timestamps,
                now + i,
                windowMs,
                maxRequests
              );
              timestamps = updatedTimestamps;
            }

            // Verify the window is full.
            const { result: blockedResult } = slidingWindowCheck(
              timestamps,
              now + maxRequests,
              windowMs,
              maxRequests
            );
            expect(blockedResult.allowed).toBe(false);

            // Advance time past the window — all previous entries should expire.
            const futureNow = now + windowMs + 1;
            const { result: allowedResult } = slidingWindowCheck(
              timestamps,
              futureNow,
              windowMs,
              maxRequests
            );
            expect(allowedResult.allowed).toBe(true);
          }
        ),
        { numRuns: 200 }
      );
    }
  );
});
