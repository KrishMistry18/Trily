import * as admin from "firebase-admin";

import { db } from "@/lib/db";

const MAX_REQUESTS_PER_MINUTE = 5;
const WINDOW_MS = 60 * 1000;

export async function checkRateLimit(userId: string): Promise<boolean> {
  const ref = db.collection("rate_limits").doc(userId);

  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(ref);
      const now = Date.now();

      let timestamps: number[] = [];
      if (doc.exists) {
        timestamps = doc.data()?.timestamps || [];
      }

      // Filter out timestamps older than the window
      const validTimestamps = timestamps.filter((t) => now - t < WINDOW_MS);

      if (validTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
        return false; // Rate limit exceeded
      }

      // Add current request
      validTimestamps.push(now);

      transaction.set(
        ref,
        {
          timestamps: validTimestamps,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return true; // Allowed
    });
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // Fail open if Firestore has a transient issue
    return true;
  }
}
