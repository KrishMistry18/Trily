/**
 * lib/env.test.ts
 *
 * Unit tests for environment variable validation (lib/env.ts).
 * Tests verify that the Zod schema correctly validates required env vars.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// We test the schema in isolation — not the live env module — so we can
// exercise validation without needing real secrets available in CI.
// ---------------------------------------------------------------------------

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  AI_PROVIDER: z.enum(["anthropic", "openai"]),
  AI_API_KEY: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().min(1),
  VERCEL_API_TOKEN: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/orbis",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "a".repeat(32),
  AI_PROVIDER: "anthropic" as const,
  AI_API_KEY: "sk-ant-test-key",
  S3_REGION: "auto",
  S3_BUCKET_NAME: "orbis-assets",
  S3_ACCESS_KEY_ID: "access-key",
  S3_SECRET_ACCESS_KEY: "secret-key",
  REDIS_URL: "redis://localhost:6379",
  STRIPE_SECRET_KEY: "sk_test_1234",
  STRIPE_WEBHOOK_SECRET: "whsec_test1234",
  STRIPE_PRICE_PRO_MONTHLY: "price_pro_monthly",
  STRIPE_PRICE_BUSINESS_MONTHLY: "price_business_monthly",
  VERCEL_API_TOKEN: "vercel-token",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_1234",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
};

describe("Environment variable schema", () => {
  it("accepts a fully valid configuration", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("applies default values for optional numeric fields", () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RATE_LIMIT_MAX_REQUESTS).toBe(5);
      expect(result.data.RATE_LIMIT_WINDOW_MS).toBe(60000);
      expect(result.data.WORKER_CONCURRENCY).toBe(3);
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    }
  });

  it("coerces string numbers to numbers for numeric fields", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      RATE_LIMIT_MAX_REQUESTS: "10",
      RATE_LIMIT_WINDOW_MS: "30000",
      WORKER_CONCURRENCY: "5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.RATE_LIMIT_MAX_REQUESTS).toBe(10);
      expect(result.data.RATE_LIMIT_WINDOW_MS).toBe(30000);
      expect(result.data.WORKER_CONCURRENCY).toBe(5);
    }
  });

  it("rejects a missing DATABASE_URL", () => {
    const { DATABASE_URL: _, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "DATABASE_URL")).toBe(true);
    }
  });

  it("rejects an invalid DATABASE_URL", () => {
    const result = envSchema.safeParse({ ...validEnv, DATABASE_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects a NEXTAUTH_SECRET shorter than 32 characters", () => {
    const result = envSchema.safeParse({ ...validEnv, NEXTAUTH_SECRET: "too-short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "NEXTAUTH_SECRET")).toBe(true);
    }
  });

  it("rejects an invalid AI_PROVIDER value", () => {
    const result = envSchema.safeParse({ ...validEnv, AI_PROVIDER: "bedrock" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "AI_PROVIDER")).toBe(true);
    }
  });

  it("rejects a STRIPE_SECRET_KEY that does not start with sk_", () => {
    const result = envSchema.safeParse({ ...validEnv, STRIPE_SECRET_KEY: "rk_test_wrong" });
    expect(result.success).toBe(false);
  });

  it("rejects a STRIPE_WEBHOOK_SECRET that does not start with whsec_", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      STRIPE_WEBHOOK_SECRET: "wrong_prefix",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY that does not start with pk_", () => {
    const result = envSchema.safeParse({
      ...validEnv,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "sk_test_wrong",
    });
    expect(result.success).toBe(false);
  });

  it("reports all missing required fields in one parse", () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(5);
    }
  });
});
