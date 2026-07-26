import { NextResponse } from "next/server";

import * as admin from "firebase-admin";

import { SUBSCRIPTION_TIERS } from "@/lib/billing/config";
import { db } from "@/lib/db";

import { SubscriptionTier } from "@/types/db";

export async function GET(request: Request) {
  // Protect the route using Vercel CRON_SECRET if available
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();

    // Find all users whose creditsResetDate has passed
    const usersSnapshot = await db
      .collection("users")
      .where("creditsResetDate", "<=", admin.firestore.Timestamp.fromDate(now))
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ message: "No users to reset at this time." });
    }

    const batch = db.batch();

    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const tier = (data.subscriptionTier as SubscriptionTier) || "free";
      const monthlyCredits =
        SUBSCRIPTION_TIERS[tier]?.monthlyCredits ?? SUBSCRIPTION_TIERS.free.monthlyCredits;

      // Calculate next reset date (1 month from now)
      const nextReset = new Date();
      nextReset.setMonth(nextReset.getMonth() + 1);

      batch.update(doc.ref, {
        creditsBalance: monthlyCredits,
        creditsResetDate: admin.firestore.Timestamp.fromDate(nextReset),
      });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully reset credits for ${usersSnapshot.size} users.`,
    });
  } catch (error) {
    console.error("Error resetting credits:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
