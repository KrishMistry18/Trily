import { SubscriptionTier } from "@/types/db";

export const FULL_GENERATION_COST = 10;
export const EDIT_COST = 2;

export type SubscriptionTierConfig = {
  monthlyCredits: number;
  priceId: string | null;
  annualPriceId?: string | null;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
};

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, SubscriptionTierConfig> = {
  free: {
    monthlyCredits: 100,
    priceId: null,
    annualPriceId: null,
    monthlyPrice: 0,
    annualPrice: 0,
    features: ["Chat-based visual edits", "Download source code", "Community support"],
  },
  pro: {
    monthlyCredits: 1000,
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
    annualPriceId: process.env.STRIPE_PRICE_PRO_ANNUAL ?? null,
    monthlyPrice: 19,
    annualPrice: 15,
    features: ["Publish to live Subdomain", "Connect Custom Domains", "Standard support"],
  },
  business: {
    monthlyCredits: 5000,
    priceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY ?? null,
    annualPriceId: process.env.STRIPE_PRICE_BUSINESS_ANNUAL ?? null,
    monthlyPrice: 49,
    annualPrice: 39,
    features: ["Priority API access", "Custom brand colors & fonts", "Priority 24/7 support"],
  },
};

export const TOP_UP_PACKS = {
  small: {
    credits: 100,
    priceId: process.env.STRIPE_PRICE_100_CREDITS ?? null,
  },
  medium: {
    credits: 500,
    priceId: process.env.STRIPE_PRICE_500_CREDITS ?? null,
  },
  large: {
    credits: 2000,
    priceId: process.env.STRIPE_PRICE_2000_CREDITS ?? null,
  },
};
