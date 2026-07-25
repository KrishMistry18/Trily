/**
 * lib/billing/stripe.ts
 *
 * Server-only Stripe SDK initialisation and typed helpers.
 *
 * IMPORTANT: This module must NEVER be imported by client-side code.
 * The Stripe secret key is only available in server-side environment variables.
 */

import Stripe from "stripe";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/billing/stripe.ts must only be imported in server-side code."
  );
}

/**
 * Singleton Stripe client, initialised with the secret key from env.
 * The `apiVersion` is pinned so upgrades are explicit.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-01-27.acacia",
  typescript: true,
});

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

/**
 * Creates a Stripe Checkout session for either a subscription or a one-off
 * credit top-up payment.
 *
 * @param customerId  Stripe customer ID (upserted on the User record)
 * @param priceId     Stripe Price ID for the desired product
 * @param mode        'subscription' for recurring plans, 'payment' for top-ups
 * @param successUrl  URL to redirect to after a successful checkout
 * @param cancelUrl   URL to redirect to if the user cancels
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  mode: "subscription" | "payment",
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return session.url;
}

/**
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription directly through Stripe's hosted portal.
 *
 * @param customerId  Stripe customer ID
 * @param returnUrl   URL to redirect to after the portal session ends
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

/**
 * Creates or retrieves a Stripe Customer for the given email.
 * Returns the Stripe customer ID to be persisted on the User record.
 *
 * @param email  User's email address
 * @param name   Optional display name
 */
export async function upsertStripeCustomer(
  email: string,
  name?: string
): Promise<string> {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) {
    return existing.data[0].id;
  }
  const customer = await stripe.customers.create({ email, name });
  return customer.id;
}

/**
 * Constructs and verifies a Stripe webhook event from raw request body and
 * signature header.
 *
 * Throws a `Stripe.errors.StripeSignatureVerificationError` if the signature
 * is invalid — callers should catch this and return HTTP 400 without touching
 * the database.
 *
 * @param rawBody   Raw request body as a Buffer or string
 * @param signature Value of the `stripe-signature` header
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET ?? ""
  );
}
