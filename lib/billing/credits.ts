/**
 * lib/billing/credits.ts
 *
 * Core logic for checking, deducting, and reading credit balances.
 * Operates purely server-side with Admin SDK bypassing security rules.
 */
import * as admin from "firebase-admin";

import { db } from "@/lib/db";

import { CreditTransaction } from "@/types/db";

import { EDIT_COST, FULL_GENERATION_COST } from "./config";

export async function getCreditsBalance(userId: string): Promise<number> {
  const userRef = db.collection("users").doc(userId);
  const snap = await userRef.get();

  if (!snap.exists) {
    return 0;
  }

  return snap.data()?.creditsBalance ?? 0;
}

export async function checkAndDeductCredits(
  userId: string,
  actionType: "generation" | "edit",
  relatedProjectId?: string,
): Promise<number> {
  const cost = actionType === "generation" ? FULL_GENERATION_COST : EDIT_COST;
  const userRef = db.collection("users").doc(userId);
  const txRef = db.collection("creditTransactions").doc();

  // Execute an atomic transaction
  const newBalance = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("User document does not exist.");
    }

    const currentBalance = userDoc.data()?.creditsBalance ?? 0;

    if (currentBalance < cost) {
      throw new Error(`Insufficient credits. You need ${cost} credits but have ${currentBalance}.`);
    }

    const updatedBalance = currentBalance - cost;

    // Deduct from user
    transaction.update(userRef, {
      creditsBalance: updatedBalance,
    });

    // Append to transaction log
    const txData: CreditTransaction = {
      txId: txRef.id,
      userId,
      amount: -cost,
      type: actionType,
      timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
    };

    if (relatedProjectId) {
      txData.relatedProjectId = relatedProjectId;
    }

    transaction.set(txRef, txData);

    return updatedBalance;
  });

  return newBalance;
}

export async function refundCredits(
  userId: string,
  amount: number,
  actionType: "generation" | "edit",
  relatedProjectId?: string,
): Promise<number> {
  const userRef = db.collection("users").doc(userId);
  const txRef = db.collection("creditTransactions").doc();

  // Execute an atomic transaction
  const newBalance = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new Error("User document does not exist.");
    }

    const currentBalance = userDoc.data()?.creditsBalance ?? 0;
    const updatedBalance = currentBalance + amount;

    transaction.update(userRef, {
      creditsBalance: updatedBalance,
    });

    const txData: CreditTransaction = {
      txId: txRef.id,
      userId,
      amount,
      type: "refund" as any, // Needs to be added to types if not there
      timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
    };

    if (relatedProjectId) {
      txData.relatedProjectId = relatedProjectId;
    }

    transaction.set(txRef, txData);

    return updatedBalance;
  });

  return newBalance;
}
