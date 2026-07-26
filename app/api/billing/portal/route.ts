/**
 * app/api/billing/portal/route.ts
 *
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage their
 * subscription directly through Stripe's hosted portal.
 *
 * Response: { url: string }
 *
 * Requirements: 2.2, 13.2, 13.3
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";

import { createPortalSession } from "@/lib/billing/stripe";
import { db } from "@/lib/db";

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

  // 2. Fetch user and verify stripeCustomerId is present
  const userDoc = await db.collection("users").doc(userId).get();
  const user = userDoc.data();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found. Please subscribe first." },
      { status: 400 },
    );
  }

  // 3. Build return URL
  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
  const returnUrl = `${origin}/account`;

  // 4. Create Stripe Customer Portal session
  const portalUrl = await createPortalSession(user.stripeCustomerId, returnUrl);

  // 5. Return the URL
  return NextResponse.json({ url: portalUrl });
}
