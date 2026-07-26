/**
 * app/api/projects/[projectId]/versions/[versionId]/route.ts
 *
 * GET  — Return version metadata + pre-signed URL.
 * POST — Revert action: creates a new version copying source HTML.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storageService } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Helper: verify project ownership
// ---------------------------------------------------------------------------

async function verifyOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  return project?.userId === userId;
}

// ---------------------------------------------------------------------------
// GET — version metadata + pre-signed URL (Req 9.2)
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; versionId: string } }
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

  const version = await db.version.findFirst({
    where: { id: versionId, projectId },
    select: {
      id: true,
      versionNumber: true,
      prompt: true,
      storageKey: true,
      deployUrl: true,
      createdAt: true,
    },
  });

  if (!version) {
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
  { params }: { params: { projectId: string; versionId: string } }
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
  const sourceVersion = await db.version.findFirst({
    where: { id: versionId, projectId },
    select: { id: true, storageKey: true, prompt: true },
  });

  if (!sourceVersion) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Fetch HTML from S3
  const codeFiles = await storageService.readVersionFiles(userId, projectId, versionId);

  // Determine new version number (MAX + 1) within a transaction
  const newVersionId = crypto.randomUUID();

  const newVersion = await db.$transaction(async (tx) => {
    const last = await tx.version.findFirst({
      where: { projectId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const newVersionNumber = (last?.versionNumber ?? 0) + 1;

    // Write new S3 object (identical HTML under new versionId path)
    const newStorageKey = `${userId}/${projectId}/${newVersionId}/index.html`;
    await storageService.writeVersionFiles(userId, projectId, newVersionId, codeFiles);

    const v = await tx.version.create({
      data: {
        id: newVersionId,
        projectId,
        versionNumber: newVersionNumber,
        prompt: sourceVersion.prompt,
        storageKey: newStorageKey,
      },
    });

    // Touch project updatedAt
    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });

    return v;
  });

  return NextResponse.json(newVersion, { status: 201 });
}
