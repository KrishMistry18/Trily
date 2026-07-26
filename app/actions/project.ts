"use server";

import { auth } from "@/auth";
import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/db";

export async function getProjectVersionAction(projectId: string, versionId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const versionDoc = await db
    .collection("projects")
    .doc(projectId)
    .collection("versions")
    .doc(versionId)
    .get();

  if (!versionDoc.exists) {
    return null;
  }

  return versionDoc.data()?.generatedCode as string;
}

export async function getProjectVersionsHistoryAction(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const snapshot = await db
    .collection("projects")
    .doc(projectId)
    .collection("versions")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    let createdAtIso = new Date().toISOString();
    if (data.createdAt && typeof data.createdAt.toDate === "function") {
      createdAtIso = data.createdAt.toDate().toISOString();
    }
    return {
      versionId: data.versionId,
      prompt: data.prompt,
      createdAt: createdAtIso,
      parentVersionId: data.parentVersionId,
    };
  });
}

export async function restoreVersionAction(
  projectId: string,
  versionIdToRestore: string,
  currentVersionId: string,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const versionToRestoreDoc = await db
    .collection("projects")
    .doc(projectId)
    .collection("versions")
    .doc(versionIdToRestore)
    .get();

  if (!versionToRestoreDoc.exists) {
    return { success: false, error: "version_not_found" };
  }

  const oldCode = versionToRestoreDoc.data()?.generatedCode || "";

  const newVersionId = randomUUID();
  const batch = db.batch();

  // Create new version mimicking the old one
  const versionRef = db
    .collection("projects")
    .doc(projectId)
    .collection("versions")
    .doc(newVersionId);
  batch.set(versionRef, {
    versionId: newVersionId,
    projectId,
    prompt: `Restored previous version`,
    generatedCode: oldCode,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: session.user.id,
    parentVersionId: currentVersionId,
  });

  // Update Project
  const projectRef = db.collection("projects").doc(projectId);
  batch.update(projectRef, {
    currentVersionId: newVersionId,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  return { success: true, versionId: newVersionId };
}
