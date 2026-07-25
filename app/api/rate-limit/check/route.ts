/**
 * app/api/rate-limit/check/route.ts
 *
 * GET /api/rate-limit/check?userId=...
 *
 * Internal helper route that exposes the rate limiter check as a JSON
 * endpoint.  Intended to be called from middleware or other server-side
 * code that cannot import the rate limiter directly (e.g. edge middleware).
 *
 * Query params:
 *   userId (required) — the user ID to check
 *
 * Response: { allowed: boolean, retryAfterMs: number }
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "userId query parameter is required" },
      { status: 400 }
    );
  }

  const result = await checkRateLimit(userId);
  return NextResponse.json(result);
}
