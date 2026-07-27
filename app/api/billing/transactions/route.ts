import { NextResponse } from "next/server";

import { auth } from "@/auth";

import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const snapshot = await db
      .collection("creditTransactions")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const transactions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        txId: data.txId,
        amount: data.amount,
        type: data.type,
        relatedProjectId: data.relatedProjectId,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    // Calculate daily usage for the last 30 days
    // Generate empty buckets for the last 30 days
    const dailyUsage: { date: string; spent: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyUsage.push({
        date: d.toISOString().split("T")[0],
        spent: 0,
      });
    }

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate spend (only count deductions: amount < 0)
    transactions.forEach((tx) => {
      if (tx.amount < 0) {
        const txDate = new Date(tx.timestamp);
        if (txDate >= thirtyDaysAgo) {
          const dateStr = txDate.toISOString().split("T")[0];
          const bucket = dailyUsage.find((b) => b.date === dateStr);
          if (bucket) {
            bucket.spent += Math.abs(tx.amount);
          }
        }
      }
    });

    return NextResponse.json({
      transactions,
      dailyUsage,
    });
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}
