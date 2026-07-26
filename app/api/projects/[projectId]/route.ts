/**
 * app/api/projects/[projectId]/route.ts
 *
 * DELETE /api/projects/:projectId
 *   - Authenticate and verify project ownership.
 *   - Delete the project and all child records (Prisma cascade).
 *   - Delete all S3 objects under {userId}/{projectId}/.
 *
 * Requirements: 12.1, 9.4
 */

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { s3 } from "@/lib/storage/s3Client";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

/** Deletes all S3 objects under a given prefix. */
async function deleteS3Prefix(userId: string, projectId: string): Promise<void> {
  const bucket = process.env.S3_BUCKET_NAME ?? "";
  const prefix = `${userId}/${projectId}/`;

  let continuationToken: string | undefined;

  do {
    const listResponse = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    const objects = listResponse.Contents ?? [];
    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map((o) => ({ Key: o.Key! })),
            Quiet: true,
          },
        })
      );
    }

    continuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (continuationToken);
}

export async function DELETE(
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

  // 3. Delete project (cascades to Version, GenerationJob, ChatMessage via Prisma)
  await db.project.delete({ where: { id: projectId } });

  // 4. Delete S3 objects (best-effort — do not fail the response if S3 fails)
  try {
    await deleteS3Prefix(userId, projectId);
  } catch (err) {
    console.error(`[delete-project] S3 cleanup failed for ${projectId}:`, err);
    // Return success — DB records are the source of truth; S3 can be cleaned up later
  }

  return new NextResponse(null, { status: 204 });
}
