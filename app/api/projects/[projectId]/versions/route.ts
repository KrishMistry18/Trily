/**
 * app/api/projects/[projectId]/versions/route.ts
 *
 * GET /api/projects/:projectId/versions
 *   - Authenticate and verify project ownership.
 *   - Return all versions sorted by versionNumber asc.
 *
 * Requirements: 9.1, 9.2, 9.4
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  // Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId } = params;

  // Verify project ownership (Req 9.4)
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return all versions sorted by versionNumber asc (Req 9.1)
  const versions = await db.version.findMany({
    where: { projectId },
    orderBy: { versionNumber: "asc" },
    select: {
      id: true,
      versionNumber: true,
      prompt: true,
      storageKey: true,
      deployUrl: true,
      createdAt: true,
    },
  });

  return NextResponse.json(versions);
}
