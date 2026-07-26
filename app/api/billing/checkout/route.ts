/**
 * app/api/billing/checkout/route.ts
 *
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout session for either a subscription or a one-off
 * credit top-up payment.
 *
 * Request body: { priceId: string, mode: 'subscription' | 'payment' }
 * Response:     { url: string }
 *
 * Requirements: 2.2, 13.2, 13.3
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { z } from "zod";

import { createCheckoutSession, upsertStripeCustomer } from "@/lib/billing/stripe";
import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const checkoutBodySchema = z.object({
  priceId: z.string().min(1),
  mode: z.enum(["subscription", "payment"]),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = checkoutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { priceId, mode } = parsed.data;

  // 3. Fetch user and upsert Stripe customer if needed
  const userDoc = await db.collection("users").doc(userId).get();
  const user = userDoc.data();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let customerId = user.stripeCustomerId;

  if (!customerId) {
    customerId = await upsertStripeCustomer(user.email ?? "", user.name ?? undefined);
    await db.collection("users").doc(userId).update({ stripeCustomerId: customerId });
  }

  // 4. Build success / cancel URLs
  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const successUrl = `${origin}/account?success=true`;
  const cancelUrl = `${origin}/account?cancelled=true`;

  // 5. Create Stripe Checkout session
  const checkoutUrl = await createCheckoutSession(customerId, priceId, mode, successUrl, cancelUrl);

  // 6. Return the URL
  return NextResponse.json({ url: checkoutUrl });
}
