/**
 * app/api/billing/balance/route.ts
 *
 * GET /api/billing/balance
 * Returns the authenticated user's current credit balance and tier.
 *
 * Requirements: 2.6, 13.1
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";

import { getCreditsBalance } from "@/lib/billing/credits";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [balance, userDoc] = await Promise.all([
    getCreditsBalance(userId),
    db.collection("users").doc(userId).get(),
  ]);

  return NextResponse.json({
    balance,
    tier: userDoc.exists ? (userDoc.data()?.subscriptionTier ?? "free") : "free",
  });
}
