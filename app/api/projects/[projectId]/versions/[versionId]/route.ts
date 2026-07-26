/**
 * app/api/projects/[projectId]/versions/[versionId]/route.ts
 *
 * GET  — Return version metadata + pre-signed URL.
 * POST — Revert action: creates a new version copying source HTML.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/db";
import { storageService } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Helper: verify project ownership
// ---------------------------------------------------------------------------

async function verifyOwnership(projectId: string, userId: string): Promise<boolean> {
  const projectDoc = await db.collection("projects").doc(projectId).get();
  return projectDoc.exists && projectDoc.data()?.ownerId === userId;
}

// ---------------------------------------------------------------------------
// GET — version metadata + pre-signed URL (Req 9.2)
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; versionId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId, versionId } = params;

  if (!(await verifyOwnership(projectId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const versionDoc = await db.collection("versions").doc(versionId).get();
  const version = versionDoc.data();

  if (!version || version.projectId !== projectId) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const presignedUrl = await storageService.getPresignedUrl(version.storageKey, 3600);

  return NextResponse.json({ ...version, presignedUrl });
}

// ---------------------------------------------------------------------------
// POST — revert action (Req 9.3)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string; versionId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId, versionId } = params;

  if (!(await verifyOwnership(projectId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "revert") {
    return NextResponse.json({ error: 'action must be "revert"' }, { status: 400 });
  }

  // Fetch source version
  const sourceVersionDoc = await db.collection("versions").doc(versionId).get();
  const sourceVersion = sourceVersionDoc.data();

  if (!sourceVersion || sourceVersion.projectId !== projectId) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Fetch HTML from S3
  const codeFiles = await storageService.readVersionFiles(userId, projectId, versionId);

  // Determine new version number (MAX + 1) within a transaction
  const newVersionId = crypto.randomUUID();

  const newVersionData: any = {
    id: newVersionId,
    projectId,
    prompt: sourceVersion.prompt,
    storageKey: `${userId}/${projectId}/${newVersionId}/index.html`,
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.runTransaction(async (tx) => {
    const versionsSnap = await tx.get(
      db
        .collection("versions")
        .where("projectId", "==", projectId)
        .orderBy("versionNumber", "desc")
        .limit(1),
    );
    const lastVersion = versionsSnap.empty ? null : versionsSnap.docs[0]?.data();
    newVersionData.versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    // Write new S3 object (identical HTML under new versionId path)
    await storageService.writeVersionFiles(userId, projectId, newVersionId, codeFiles);

    tx.set(db.collection("versions").doc(newVersionId), newVersionData);

    // Touch project updatedAt
    tx.update(db.collection("projects").doc(projectId), {
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return NextResponse.json(newVersionData, { status: 201 });
}
