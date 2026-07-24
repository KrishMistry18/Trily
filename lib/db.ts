/**
 * lib/db.ts
 *
 * Edge-safe singleton Prisma client.
 *
 * In development, reuses a single PrismaClient instance across hot-module
 * reloads to avoid exhausting the database connection pool.
 * In production, a fresh client is created once per serverless function
 * instance or long-running process.
 *
 * This pattern is recommended by the Prisma docs for Next.js:
 * https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

import { PrismaClient } from "@prisma/client";

// Extend the global namespace to cache the client in development.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

// In production, always use a fresh instance.
// In development/test, reuse the cached global instance to prevent connection
// pool exhaustion during hot reloads.
export const db: PrismaClient =
  process.env.NODE_ENV === "production"
    ? createPrismaClient()
    : (globalThis.__prisma ?? (globalThis.__prisma = createPrismaClient()));
