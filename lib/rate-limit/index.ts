/**
 * lib/rate-limit/index.ts
 *
 * Sliding-window rate limiter backed by Redis ZADD / ZREMRANGEBYSCORE.
 *
 * Algorithm:
 *   1. Compute windowStart = now - windowMs.
 *   2. ZREMRANGEBYSCORE removes entries older than windowStart.
 *   3. ZCARD counts remaining entries in the window.
 *   4. If count >= maxRequests → return { allowed: false, retryAfterMs }.
 *   5. Otherwise → ZADD the new entry with score = now, return { allowed: true, retryAfterMs: 0 }.
 *
 * retryAfterMs: time in ms until the oldest entry in the current window expires.
 *              Computed as (oldest_entry_score + windowMs) - now.
 *
 * Config is read from env on EVERY invocation (no module-level caching) so
 * changes to RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX_REQUESTS take effect
 * immediately without a restart.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { redis } from "@/lib/queue/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Checks whether the given user is within the configured rate limit.
 *
 * @param userId  The user whose request rate is being checked.
 * @returns `{ allowed, retryAfterMs }` — if `allowed` is false,
 *          `retryAfterMs` is the number of milliseconds until the next
 *          request would be permitted.
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  // Read config fresh on every call (no module-level caching per requirements).
  const windowMs = parseInt(
    process.env.RATE_LIMIT_WINDOW_MS ?? "60000",
    10
  );
  const maxRequests = parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS ?? "5",
    10
  );

  const key = `rate:${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  // Use a pipeline (multi-exec) to minimise round trips.
  const pipeline = redis.pipeline();

  // Remove entries that have fallen outside the window.
  pipeline.zremrangebyscore(key, "-inf", windowStart);

  // Count remaining entries in the current window.
  pipeline.zcard(key);

  // Retrieve the oldest entry (lowest score) for retryAfterMs computation.
  pipeline.zrange(key, 0, 0, "WITHSCORES");

  // Set an expiry on the key so Redis auto-cleans idle users.
  pipeline.expire(key, Math.ceil(windowMs / 1000));

  const results = await pipeline.exec();
  // results: [[err, removeCount], [err, count], [err, [member, score]], [err, expireResult]]

  const count = (results?.[1]?.[1] as number) ?? 0;
  const oldestEntry = results?.[2]?.[1] as string[] | null;

  if (count >= maxRequests) {
    // Calculate when the oldest entry will expire so the caller knows how long
    // to wait before trying again.
    let retryAfterMs = windowMs; // safe default
    if (oldestEntry && oldestEntry.length >= 2 && oldestEntry[1] !== undefined) {
      const oldestScore = parseFloat(oldestEntry[1]);
      retryAfterMs = Math.max(0, oldestScore + windowMs - now);
    }
    return { allowed: false, retryAfterMs };
  }

  // Under the limit — add this request to the sorted set.
  // Use a unique member (now + random) to avoid collisions for burst requests.
  const member = `${now}:${Math.random().toString(36).slice(2)}`;
  await redis.zadd(key, now, member);
  await redis.expire(key, Math.ceil(windowMs / 1000));

  return { allowed: true, retryAfterMs: 0 };
}
