/**
 * lib/billing/credits.ts
 *
 * Pure credit-ledger helpers.
 *
 * All functions interact only with the `creditLedgers` Firestore collection.
 * They accept an optional `tx` (Firebase Transaction) parameter
 * so they can be composed inside a single DB transaction when required.
 *
 * Design note: `balanceAfter` is a denormalised snapshot that lets us retrieve
 * the current balance with a single query (latest doc) rather than
 * summing the entire ledger.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import { randomUUID } from "crypto";
import * as admin from "firebase-admin";

import { db } from "@/lib/db";

export enum CreditEventType {
  DEDUCTION = "DEDUCTION",
  TOP_UP = "TOP_UP",
  REFUND = "REFUND",
  MONTHLY_GRANT = "MONTHLY_GRANT",
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  eventType: CreditEventType;
  amount: number;
  balanceAfter: number;
  generationJobId: string | null;
  stripePaymentId: string | null;
  createdAt: Date;
}

type Transaction = admin.firestore.Transaction;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the user's current credit balance.
 *
 * Reads the `balanceAfter` column from the most recent CreditLedger row for
 * the user (ordered by `createdAt DESC`).  Returns 0 if no ledger entries
 * exist yet.
 */
export async function getCreditBalance(userId: string, tx?: Transaction): Promise<number> {
  const query = db.collection("creditLedgers").where("userId", "==", userId);

  let snapshot;
  if (tx) {
    snapshot = await tx.get(query);
  } else {
    snapshot = await query.get();
  }

  if (snapshot.empty) {
    return 0;
  }

  const docs = snapshot.docs.map((doc) => doc.data());
  docs.sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bTime - aTime;
  });

  return docs[0].balanceAfter ?? 0;
}

/**
 * Returns true if the user has a credit balance strictly greater than zero.
 */
export async function hasSufficientCredits(userId: string, tx?: Transaction): Promise<boolean> {
  const balance = await getCreditBalance(userId, tx);
  return balance > 0;
}

/**
 * Inserts a DEDUCTION ledger entry and returns the new entry.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  jobId: string,
  tx?: Transaction,
): Promise<CreditLedgerEntry> {
  const currentBalance = await getCreditBalance(userId, tx);
  const balanceAfter = currentBalance - amount;

  const docRef = db.collection("creditLedgers").doc();
  const data = {
    id: docRef.id,
    userId,
    eventType: CreditEventType.DEDUCTION,
    amount,
    balanceAfter,
    generationJobId: jobId,
    stripePaymentId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tx) {
    tx.set(docRef, data);
  } else {
    await docRef.set(data);
  }

  return { ...data, createdAt: new Date() } as CreditLedgerEntry;
}

/**
 * Inserts a REFUND ledger entry and returns the new entry.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  jobId: string,
  tx?: Transaction,
): Promise<CreditLedgerEntry> {
  const currentBalance = await getCreditBalance(userId, tx);
  const balanceAfter = currentBalance + amount;

  const docRef = db.collection("creditLedgers").doc();
  const data = {
    id: docRef.id,
    userId,
    eventType: CreditEventType.REFUND,
    amount,
    balanceAfter,
    generationJobId: jobId,
    stripePaymentId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tx) {
    tx.set(docRef, data);
  } else {
    await docRef.set(data);
  }

  return { ...data, createdAt: new Date() } as CreditLedgerEntry;
}

/**
 * Inserts a MONTHLY_GRANT ledger entry and returns the new entry.
 */
export async function grantMonthlyCredits(
  userId: string,
  amount: number,
  tx?: Transaction,
): Promise<CreditLedgerEntry> {
  const currentBalance = await getCreditBalance(userId, tx);
  const balanceAfter = currentBalance + amount;

  const docRef = db.collection("creditLedgers").doc();
  const data = {
    id: docRef.id,
    userId,
    eventType: CreditEventType.MONTHLY_GRANT,
    amount,
    balanceAfter,
    generationJobId: null,
    stripePaymentId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (tx) {
    tx.set(docRef, data);
  } else {
    await docRef.set(data);
  }

  return { ...data, createdAt: new Date() } as CreditLedgerEntry;
}
