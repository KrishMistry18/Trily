/**
 * lib/env.ts
 *
 * Validates and exports all required environment variables at startup using Zod.
 * Import this module (server-side only) to get typed, validated access to env vars.
 *
 * Requirement 16.4 — secrets must never be included in the client-side bundle.
 * This file is intentionally server-only: never import it from client components.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection URL"),

  // NextAuth
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  // AI Provider
  AI_PROVIDER: z.enum(["anthropic", "openai"], {
    errorMap: () => ({ message: 'AI_PROVIDER must be "anthropic" or "openai"' }),
  }),
  AI_API_KEY: z.string().min(1, "AI_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-sonnet-20241022"),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),

  // Image Generation (optional — only required when IMAGE_PROVIDER is set)
  IMAGE_PROVIDER: z.enum(["replicate", "fal"]).optional(),
  REPLICATE_API_TOKEN: z.string().optional(),
  FAL_API_KEY: z.string().optional(),

  // Storage (S3 / R2)
  S3_REGION: z.string().min(1, "S3_REGION is required"),
  S3_BUCKET_NAME: z.string().min(1, "S3_BUCKET_NAME is required"),
  S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required"),
  S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required"),
  S3_ENDPOINT: z.string().optional(),

  // Redis
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "STRIPE_SECRET_KEY must start with sk_"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with whsec_"),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1, "STRIPE_PRICE_PRO_MONTHLY is required"),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().min(1, "STRIPE_PRICE_BUSINESS_MONTHLY is required"),

  // Vercel
  VERCEL_API_TOKEN: z.string().min(1, "VERCEL_API_TOKEN is required"),

  // Rate Limiting
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),

  // Public (safe to expose)
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("pk_", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_"),
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Parsed and validated environment variables.
 * Throws at module load time if any required variable is missing or invalid,
 * ensuring the application never starts in a mis-configured state.
 */
function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `\n\n❌  Invalid environment variables:\n${formatted}\n\n` +
        `See .env.example for required variables.\n`,
    );
  }

  return result.data;
}

export const env = validateEnv();

// ---------------------------------------------------------------------------
// Type export
// ---------------------------------------------------------------------------

export type Env = z.infer<typeof envSchema>;
