/**
 * app/api/projects/[projectId]/export/route.ts
 *
 * POST /api/projects/:projectId/export
 *   - Authenticate and verify project ownership.
 *   - Fetch the latest version's HTML from S3.
 *   - Create a ZIP archive containing index.html using JSZip.
 *   - Upload the ZIP to S3 via storageService.writeZipArchive.
 *   - Generate a pre-signed URL (3600s), return { downloadUrl, expiresAt }.
 *   - Does NOT modify the CreditLedger.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { storageService } from "@/lib/storage";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
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
    select: { userId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Fetch the latest version
  const latestVersion = await db.version.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, storageKey: true },
  });

  if (!latestVersion) {
    return NextResponse.json(
      { error: "No versions found for this project" },
      { status: 404 }
    );
  }

  // 4. Read HTML from S3
  const codeFiles = await storageService.readVersionFiles(
    userId,
    projectId,
    latestVersion.id
  );

  // 5. Create ZIP archive with JSZip (Req 10.1, 10.2)
  const zip = new JSZip();
  zip.file("index.html", codeFiles.html);
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

  // 6. Upload ZIP to S3 (Req 10.2)
  const zipKey = await storageService.writeZipArchive(
    userId,
    projectId,
    latestVersion.id,
    zipBuffer
  );

  // 7. Generate pre-signed URL (3600s expiry) (Req 10.3)
  const expiresInSeconds = 3600;
  const downloadUrl = await storageService.getPresignedUrl(zipKey, expiresInSeconds);

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  // NOTE: CreditLedger is intentionally NOT modified (Req 10.4)

  return NextResponse.json({ downloadUrl, expiresAt });
}
