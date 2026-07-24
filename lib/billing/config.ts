/**
 * lib/billing/config.ts
 *
 * Tier credit allowances and credit cost constants.
 * These are stored in code (not the database) and are referenced by both
 * the billing service and the seed script.
 */

import { Tier } from "@prisma/client";

/**
 * Per-tier configuration.
 * - monthlyCredits: number of credits granted at the start of each billing cycle.
 * - priceId: Stripe Price ID for the recurring subscription (null for Free tier).
 */
export const TIER_CONFIG: Record<
  Tier,
  { monthlyCredits: number; priceId: string | null }
> = {
  FREE: { monthlyCredits: 10, priceId: null },
  PRO: { monthlyCredits: 100, priceId: "price_pro_monthly" },
  BUSINESS: { monthlyCredits: 500, priceId: "price_business_monthly" },
} as const;

/**
 * Credit costs for each generation action.
 */
export const CREDIT_COSTS = {
  CREATE_JOB: 5,
  EDIT_JOB: 2,
  IMAGE_JOB: 3,
} as const;
