"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { SUBSCRIPTION_TIERS, TOP_UP_PACKS } from "@/lib/billing/config";
import {
  createCheckoutSession,
  createPortalSession,
  upsertStripeCustomer,
} from "@/lib/billing/stripe";
import { db } from "@/lib/db";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("Unauthorized");
  }
  return {
    ...session.user,
    id: session.user.id,
    email: session.user.email,
  };
}

async function getOrCreateCustomerId(
  userId: string,
  email: string,
  name?: string,
): Promise<string> {
  const userRef = db.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new Error("User not found in DB");
  }

  let customerId = userDoc.data()?.stripeCustomerId;

  if (!customerId) {
    customerId = await upsertStripeCustomer(email, name);
    await userRef.update({ stripeCustomerId: customerId });
  }

  return customerId;
}

export async function createTopUpCheckoutSessionAction(packKey: "small" | "medium" | "large") {
  const user = await getAuthenticatedUser();
  const customerId = await getOrCreateCustomerId(user.id, user.email, user.name || undefined);

  const pack = TOP_UP_PACKS[packKey];
  if (!pack || !pack.priceId) {
    throw new Error("Invalid pack or price ID not configured");
  }

  const successUrl = `${BASE_URL}/billing?success=true`;
  const cancelUrl = `${BASE_URL}/billing?canceled=true`;

  const url = await createCheckoutSession(
    customerId,
    pack.priceId,
    "payment",
    successUrl,
    cancelUrl,
    { type: "top_up", credits: pack.credits.toString() },
  );
  redirect(url);
}

export async function createSubscriptionCheckoutSessionAction(tier: "pro" | "business") {
  const user = await getAuthenticatedUser();
  const customerId = await getOrCreateCustomerId(user.id, user.email, user.name || undefined);

  const config = SUBSCRIPTION_TIERS[tier];
  if (!config || !config.priceId) {
    throw new Error("Invalid tier or price ID not configured");
  }

  const successUrl = `${BASE_URL}/billing?success=true`;
  const cancelUrl = `${BASE_URL}/billing?canceled=true`;

  const url = await createCheckoutSession(
    customerId,
    config.priceId,
    "subscription",
    successUrl,
    cancelUrl,
    { type: "subscription", tier },
  );
  redirect(url);
}

export async function createCustomerPortalSessionAction() {
  const user = await getAuthenticatedUser();
  const customerId = await getOrCreateCustomerId(user.id, user.email, user.name || undefined);

  const returnUrl = `${BASE_URL}/billing`;

  const url = await createPortalSession(customerId, returnUrl);
  redirect(url);
}
