"use server";

import { auth } from "@/auth";
import * as admin from "firebase-admin";

import { db } from "@/lib/db";

export async function togglePublishAction(projectId: string, isPublic: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userDoc = await db.collection("users").doc(session.user.id).get();
  const tier = userDoc.data()?.subscriptionTier || "free";
  if (tier === "free") {
    return { success: false, error: "upgrade_required" };
  }

  const projectRef = db.collection("projects").doc(projectId);
  const doc = await projectRef.get();
  if (!doc.exists || doc.data()?.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized");
  }

  await projectRef.update({
    isPublic,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
}

export async function updateCustomDomainAction(projectId: string, customDomain: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userDoc = await db.collection("users").doc(session.user.id).get();
  const tier = userDoc.data()?.subscriptionTier || "free";
  if (tier === "free") {
    return { success: false, error: "upgrade_required" };
  }

  const cleanedDomain = customDomain
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();

  const projectRef = db.collection("projects").doc(projectId);
  const doc = await projectRef.get();
  if (!doc.exists || doc.data()?.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized");
  }

  if (cleanedDomain) {
    const existing = await db
      .collection("projects")
      .where("customDomain", "==", cleanedDomain)
      .get();
    if (!existing.empty && existing.docs[0].id !== projectId) {
      return { success: false, error: "domain_in_use" };
    }
  }

  await projectRef.update({
    customDomain: cleanedDomain || admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, cleanedDomain };
}

export async function getPublishSettingsAction(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userDoc = await db.collection("users").doc(session.user.id).get();
  const tier = userDoc.data()?.subscriptionTier || "free";

  const projectRef = db.collection("projects").doc(projectId);
  const doc = await projectRef.get();
  if (!doc.exists || doc.data()?.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized");
  }

  const data = doc.data()!;
  return {
    isPublic: data.isPublic || false,
    customDomain: data.customDomain || "",
    tier,
  };
}
