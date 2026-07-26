import { NextRequest, NextResponse } from "next/server";

import * as admin from "firebase-admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";
import Stripe from "stripe";

import { SUBSCRIPTION_TIERS } from "@/lib/billing/config";
import { constructWebhookEvent } from "@/lib/billing/stripe";
import { db } from "@/lib/db";

import { CreditTransaction, SubscriptionTier } from "@/types/db";

export const runtime = "nodejs";

async function findUserIdByStripeCustomer(customerId: string): Promise<string | null> {
  const snapshot = await db.collection("users").where("stripeCustomerId", "==", customerId).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  if (!doc) return null;
  return doc.id;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, tx: Transaction) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) return;

  const userId = await findUserIdByStripeCustomer(customerId);
  if (!userId) return;

  const userRef = db.collection("users").doc(userId);
  const userDoc = await tx.get(userRef);
  if (!userDoc.exists) return;

  const metadata = session.metadata ?? {};

  if (metadata.type === "top_up") {
    const credits = parseInt(metadata.credits ?? "0", 10);
    if (credits <= 0) return;

    const currentBalance = userDoc.data()?.creditsBalance ?? 0;

    tx.update(userRef, {
      creditsBalance: currentBalance + credits,
    });

    const txRef = db.collection("creditTransactions").doc();
    const txData: CreditTransaction = {
      txId: txRef.id,
      userId: userId,
      amount: credits,
      type: "purchase",
      timestamp: FieldValue.serverTimestamp() as any,
    };
    tx.set(txRef, txData);
  } else if (metadata.type === "subscription") {
    const tier = (metadata.tier as SubscriptionTier) ?? "pro";
    const monthlyCredits = SUBSCRIPTION_TIERS[tier]?.monthlyCredits ?? 0;

    const currentBalance = userDoc.data()?.creditsBalance ?? 0;

    tx.update(userRef, {
      subscriptionTier: tier,
      creditsBalance: currentBalance + monthlyCredits,
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, tx: Transaction) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const userId = await findUserIdByStripeCustomer(customerId);
  if (!userId) return;

  const userRef = db.collection("users").doc(userId);
  const userDoc = await tx.get(userRef);
  if (!userDoc.exists) return;

  let newTier: SubscriptionTier = "free";
  const priceId = subscription.items.data[0]?.price.id;

  if (priceId === process.env.STRIPE_PRICE_BUSINESS_MONTHLY) {
    newTier = "business";
  } else if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY) {
    newTier = "pro";
  }

  tx.update(userRef, {
    subscriptionTier: newTier,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, tx: Transaction) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const userId = await findUserIdByStripeCustomer(customerId);
  if (!userId) return;

  const userRef = db.collection("users").doc(userId);

  tx.update(userRef, {
    subscriptionTier: "free",
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature";
    console.error("[webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const eventRef = db.collection("stripeEvents").doc(event.id);

    await db.runTransaction(async (tx) => {
      const eventDoc = await tx.get(eventRef);
      if (eventDoc.exists) {
        return;
      }

      tx.set(eventRef, {
        id: event.id,
        type: event.type,
        createdAt: FieldValue.serverTimestamp(),
      });

      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, tx);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, tx);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, tx);
          break;
      }
    });
  } catch (err) {
    console.error(`[webhook] Error processing event ${event.id}:`, err);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
