"use server";

import { auth } from "@/auth";

import { trackEvent } from "@/lib/analytics";
import { db } from "@/lib/db";

export async function markOnboardingSeenAction() {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await db.collection("users").doc(session.user.id).update({
      hasSeenOnboarding: true,
    });
    trackEvent("onboarding_completed", { userId: session.user.id });
    return { success: true };
  } catch (error) {
    console.error("Failed to mark onboarding as seen", error);
    return { success: false };
  }
}
