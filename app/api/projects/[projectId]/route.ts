/**
 * app/api/projects/[projectId]/route.ts
 *
 * DELETE /api/projects/:projectId
 *   - Authenticate and verify project ownership.
 *   - Delete the project and all child records from Firestore.
 *   - Delete all Firebase Storage objects under {userId}/{projectId}/.
 *
 * Requirements: 12.1, 9.4
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
// Using standard firebase-admin if initialized
import * as admin from "firebase-admin";

import { db } from "@/lib/db";
import { storage } from "@/lib/firebase";

/** Deletes all Firebase Storage objects under a given prefix. */
async function deleteStoragePrefix(userId: string, projectId: string): Promise<void> {
  const prefix = `${userId}/${projectId}/`;
  const bucket = admin.storage().bucket();

  await bucket.deleteFiles({ prefix });
}

export async function DELETE(_req: NextRequest, { params }: { params: { projectId: string } }) {
  // 1. Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId } = params;

  // 2. Verify project ownership
  const projectDoc = await db.collection("projects").doc(projectId).get();

  if (!projectDoc.exists) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (projectDoc.data()?.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Delete project and its children from Firestore
  const batch = db.batch();

  // Delete the project document
  batch.delete(projectDoc.ref);

  // Delete all versions for this project
  const versionsSnap = await db.collection("versions").where("projectId", "==", projectId).get();
  versionsSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // Delete all chat messages for this project
  const chatsSnap = await db.collection("chatMessages").where("projectId", "==", projectId).get();
  chatsSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // Delete all generation jobs for this project
  const jobsSnap = await db.collection("generationJobs").where("projectId", "==", projectId).get();
  jobsSnap.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  // 4. Delete Storage objects (best-effort)
  try {
    await deleteStoragePrefix(userId, projectId);
  } catch (err) {
    console.error(`[delete-project] Storage cleanup failed for ${projectId}:`, err);
    // Return success — DB records are the source of truth
  }

  return new NextResponse(null, { status: 204 });
}
