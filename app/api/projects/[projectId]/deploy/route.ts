/**
 * app/api/projects/[projectId]/deploy/route.ts
 *
 * POST /api/projects/:projectId/deploy
 *   - Authenticate and verify project ownership.
 *   - Fetch the latest version's HTML from S3.
 *   - Call deployToVercel(projectName, files, versionId).
 *   - On success: UPDATE Version.deployUrl, return { deployUrl, versionId }.
 *   - On error: return 502; do NOT modify the Version record.
 *   - Does NOT modify CreditLedger.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";

import { deployToVercel } from "@/lib/ai/vercel-deploy";
import { db } from "@/lib/db";
import { storageService } from "@/lib/storage";

export async function POST(_req: NextRequest, { params }: { params: { projectId: string } }) {
  // 1. Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId } = params;

  // 2. Verify project ownership
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { userId: true, name: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Fetch latest version
  const latestVersion = await db.version.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, storageKey: true },
  });

  if (!latestVersion) {
    return NextResponse.json({ error: "No versions found for this project" }, { status: 404 });
  }

  // 4. Fetch HTML from S3
  const codeFiles = await storageService.readVersionFiles(userId, projectId, latestVersion.id);

  // 5. Deploy to Vercel (Req 11.1)
  try {
    const projectName = `trily-${projectId}`;
    const { deployUrl } = await deployToVercel(projectName, codeFiles, latestVersion.id);

    // 6. On success: UPDATE Version.deployUrl (Req 11.2)
    await db.version.update({
      where: { id: latestVersion.id },
      data: { deployUrl },
    });

    // NOTE: CreditLedger is intentionally NOT modified (Req 11.4)
    return NextResponse.json({ deployUrl, versionId: latestVersion.id });
  } catch (err) {
    // 7. On error: return 502 and do NOT modify the Version record (Req 11.3)
    const message = err instanceof Error ? err.message : "Vercel deployment failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
