/**
 * app/api/billing/balance/route.ts
 *
 * GET /api/billing/balance
 * Returns the authenticated user's current credit balance and tier.
 *
 * Requirements: 2.6, 13.1
 */

import { auth } from "@/auth";
import { getCreditBalance } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [balance, user] = await Promise.all([
    getCreditBalance(userId),
    db.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    }),
  ]);

  return NextResponse.json({
    balance,
    tier: user?.tier ?? "FREE",
  });
}
