/**
 * app/api/projects/[projectId]/versions/route.ts
 *
 * GET /api/projects/:projectId/versions
 *   - Authenticate and verify project ownership.
 *   - Return all versions sorted by versionNumber asc.
 *
 * Requirements: 9.1, 9.2, 9.4
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";

import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  // Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId } = params;

  // Verify project ownership (Req 9.4)
  const projectDoc = await db.collection("projects").doc(projectId).get();

  if (!projectDoc.exists) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (projectDoc.data()?.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return all versions sorted by versionNumber asc (Req 9.1)
  const versionsSnap = await db
    .collection("versions")
    .where("projectId", "==", projectId)
    .orderBy("versionNumber", "asc")
    .get();

  const versions = versionsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id,
      versionNumber: data.versionNumber,
      prompt: data.prompt,
      storageKey: data.storageKey,
      deployUrl: data.deployUrl,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    };
  });

  return NextResponse.json(versions);
}
