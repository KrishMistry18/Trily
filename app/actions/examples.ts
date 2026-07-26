"use server";

import { db } from "@/lib/db";

import { OfficialExample } from "@/types/db";

export async function getOfficialExamples(limitCount?: number): Promise<OfficialExample[]> {
  try {
    let query = db.collection("officialExamples").orderBy("createdAt", "desc");

    if (limitCount) {
      query = query.limit(limitCount);
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as unknown as OfficialExample;
    });
  } catch (error) {
    console.error("Failed to fetch official examples:", error);
    return [];
  }
}

export async function getOfficialExampleBySlug(slug: string): Promise<OfficialExample | null> {
  try {
    const snapshot = await db
      .collection("officialExamples")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    if (!doc) return null;
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    } as unknown as OfficialExample;
  } catch (error) {
    console.error("Failed to fetch official example by slug:", error);
    return null;
  }
}
