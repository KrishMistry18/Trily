/**
 * app/api/billing/webhook/route.ts
 *
 * Stripe webhook handler.
 *
 * Security gate: the raw request body and the `stripe-signature` header are
 * passed to `constructWebhookEvent`, which throws
 * `Stripe.errors.StripeSignatureVerificationError` on any invalid signature.
 * When that happens the handler returns HTTP 400 WITHOUT touching the database.
 *
 * Idempotency: each processed Stripe event ID is recorded in the `StripeEvent`
 * table (inside the same DB transaction as the ledger writes).  A duplicate
 * delivery returns HTTP 200 immediately without re-processing.
 *
 * Supported event types:
 *   checkout.session.completed    — top-up or new subscription start
 *   customer.subscription.updated — tier change / upgrade
 *   customer.subscription.deleted — cancellation → FREE tier
 *   invoice.payment_succeeded     — monthly credit renewal
 *
 * Requirements: 2.3, 2.7, 2.8
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { TIER_CONFIG } from "@/lib/billing/config";
import { grantMonthlyCredits } from "@/lib/billing/credits";
import { constructWebhookEvent } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { Prisma, Tier } from "@prisma/client";

// This route must run in the Node.js runtime (not Edge) so that
// `request.text()` can read the raw body for Stripe signature verification.
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a Stripe customer ID to an internal User record.
 * Returns null when no user has that stripeCustomerId.
 */
async function findUserByStripeCustomer(
  customerId: string,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; tier: Tier } | null> {
  const client = (tx ?? db) as Prisma.TransactionClient;
  return client.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, tier: true },
  });
}

/**
 * Maps a Stripe plan nickname or Price ID to an internal Tier.
 * Falls back to PRO when no match is found.
 */
function tierFromPlan(nickname: string | null, priceId: string | null): Tier {
  if (nickname) {
    const upper = nickname.toUpperCase();
    if (upper.includes("BUSINESS")) return Tier.BUSINESS;
    if (upper.includes("PRO")) return Tier.PRO;
    if (upper.includes("FREE")) return Tier.FREE;
  }
  if (priceId) {
    if (priceId === TIER_CONFIG.BUSINESS.priceId) return Tier.BUSINESS;
    if (priceId === TIER_CONFIG.PRO.priceId) return Tier.PRO;
  }
  return Tier.PRO;
}

/**
 * Returns true if `newTier` is a higher tier than `currentTier`.
 * Used to decide whether to issue a MONTHLY_GRANT on subscription update.
 */
function isUpgrade(currentTier: Tier, newTier: Tier): boolean {
  const rank: Record<Tier, number> = { FREE: 0, PRO: 1, BUSINESS: 2 };
  return rank[newTier] > rank[currentTier];
}

/**
 * Returns the most recent balanceAfter for a user within a transaction,
 * or 0 if no ledger entries exist.
 */
async function getRunningBalance(
  userId: string,
  tx: Prisma.TransactionClient
): Promise<number> {
  const latest = await tx.creditLedger.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  return latest?.balanceAfter ?? 0;
}

// ---------------------------------------------------------------------------
// Per-event handlers
// Each handler receives the Stripe event object and the transactional
// Prisma client so all DB writes are part of the same transaction as the
// StripeEvent idempotency record.
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  tx: Prisma.TransactionClient
): Promise<void> {
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  if (!customerId) return;

  const user = await findUserByStripeCustomer(customerId, tx);
  if (!user) return;

  const metadata = session.metadata ?? {};

  if (metadata.type === "top_up") {
    // One-off credit top-up — insert TOP_UP ledger entry
    const credits = parseInt(metadata.credits ?? "0", 10);
    if (credits <= 0) return;

    const currentBalance = await getRunningBalance(user.id, tx);
    const stripePaymentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    await tx.creditLedger.create({
      data: {
        userId: user.id,
        eventType: "TOP_UP",
        amount: credits,
        balanceAfter: currentBalance + credits,
        stripePaymentId,
      },
    });
  } else {
    // New subscription start — update tier and grant monthly credits
    const priceId = metadata.priceId ?? null;
    const newTier = tierFromPlan(null, priceId);
    const monthlyCredits = TIER_CONFIG[newTier].monthlyCredits;

    await tx.user.update({
      where: { id: user.id },
      data: { tier: newTier },
    });

    await grantMonthlyCredits(user.id, monthlyCredits, tx);
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  tx: Prisma.TransactionClient
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const user = await findUserByStripeCustomer(customerId, tx);
  if (!user) return;

  // Determine the new tier from the subscription's price or its nickname
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const nickname = item?.price?.nickname ?? null;
  const newTier = tierFromPlan(nickname, priceId);

  const shouldGrant = isUpgrade(user.tier, newTier);

  await tx.user.update({
    where: { id: user.id },
    data: { tier: newTier },
  });

  if (shouldGrant) {
    await grantMonthlyCredits(user.id, TIER_CONFIG[newTier].monthlyCredits, tx);
  }
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  tx: Prisma.TransactionClient
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const user = await findUserByStripeCustomer(customerId, tx);
  if (!user) return;

  await tx.user.update({
    where: { id: user.id },
    data: { tier: Tier.FREE },
  });
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  tx: Prisma.TransactionClient
): Promise<void> {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;

  if (!customerId) return;

  // Only process subscription renewal cycles (not first payment or top-ups)
  if (invoice.billing_reason !== "subscription_cycle") return;

  const user = await findUserByStripeCustomer(customerId, tx);
  if (!user) return;

  const monthlyCredits = TIER_CONFIG[user.tier].monthlyCredits;
  await grantMonthlyCredits(user.id, monthlyCredits, tx);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read raw body (required for Stripe signature verification)
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // 2. Validate Stripe signature — return 400 without touching the DB
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid webhook signature";
    console.error("[webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Idempotency pre-check — fast path if event was already processed
  const existing = await db.stripeEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 4. Process the event — all DB writes (including the StripeEvent record)
  //    are committed in a single transaction for atomicity and idempotency.
  try {
    await db.$transaction(async (tx) => {
      // Record the event ID first — unique constraint prevents duplicate processing
      // even if two deliveries race past the pre-check above.
      await tx.stripeEvent.create({
        data: { id: event.id, type: event.type },
      });

      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
            tx
          );
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
            tx
          );
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
            tx
          );
          break;

        case "invoice.payment_succeeded":
          await handleInvoicePaymentSucceeded(
            event.data.object as Stripe.Invoice,
            tx
          );
          break;

        default:
          // Unknown event type — acknowledge without processing
          break;
      }
    });
  } catch (err) {
    // If the StripeEvent insert fails due to a unique constraint violation,
    // another concurrent request already processed this event — return 200.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.error(`[webhook] Error processing event ${event.id}:`, err);
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
