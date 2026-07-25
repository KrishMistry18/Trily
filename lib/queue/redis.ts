/**
 * lib/queue/redis.ts
 *
 * Shared ioredis client used by both the rate limiter and BullMQ.
 *
 * The connection URL is read from `REDIS_URL` (required in production).
 * During tests or local development the URL may fall back to a default
 * localhost address; a real Redis instance must be available for integration
 * tests.
 *
 * The singleton pattern prevents multiple connections being created on hot
 * reloads in development (same behaviour as the Prisma db singleton).
 */

import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, {
    // Disable auto-reconnect after max retries in test environments
    // to prevent hanging connections.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redis: Redis =
  process.env.NODE_ENV === "production"
    ? createRedisClient()
    : (globalThis.__redis ?? (globalThis.__redis = createRedisClient()));

export default redis;
