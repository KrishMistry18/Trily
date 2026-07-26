/**
 * app/api/projects/[projectId]/chat/route.ts
 *
 * POST /api/projects/:projectId/chat  — Submit an edit prompt.
 * GET  /api/projects/:projectId/chat  — Return all chat messages (chronological).
 *
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { JobStatus, JobType } from "@/types";
import * as admin from "firebase-admin";

import { checkAndDeductCredits, getCreditsBalance } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { generationQueue } from "@/lib/queue/generationQueue";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  EDIT_PROMPT_MAX_LENGTH,
  EDIT_PROMPT_MIN_LENGTH,
  validateEditPromptLength,
} from "@/lib/validation/prompt";

// ---------------------------------------------------------------------------
// Helper: verify project ownership
// ---------------------------------------------------------------------------

async function verifyOwnership(projectId: string, userId: string): Promise<boolean> {
  const projectDoc = await db.collection("projects").doc(projectId).get();
  return projectDoc.exists && projectDoc.data()?.ownerId === userId;
}

// ---------------------------------------------------------------------------
// POST — Submit edit prompt (Req 8.1, 8.2, 8.4, 8.6)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: { params: { projectId: string } }) {
  // 1. Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId } = params;

  // 2. Verify ownership
  if (!(await verifyOwnership(projectId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt } = body as { prompt: unknown };

  // 4. Validate edit prompt length (Req 8.1)
  const promptError = validateEditPromptLength(prompt);
  if (promptError) {
    return NextResponse.json({ error: promptError }, { status: 400 });
  }

  const validPrompt = prompt as string;

  // 5. Rate limit check
  const rateLimitResult = await checkRateLimit(userId);
  if (!rateLimitResult.allowed) {
    const retryAfterSeconds = Math.ceil(rateLimitResult.retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    );
  }

  // 6. Check credit balance
  const balance = await getCreditsBalance(userId);
  if (balance <= 0) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // 7. Fetch latest version for the project (needed by the worker)
  const versionsSnap = await db
    .collection("versions")
    .where("projectId", "==", projectId)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  let latestVersionId = null;
  if (!versionsSnap.empty) {
    latestVersionId = versionsSnap.docs[0].id;
  }

  // 8. Deduct credits and insert ChatMessage + GenerationJob
  const chatMessageRef = db.collection("chatMessages").doc();
  const jobRef = db.collection("generationJobs").doc();

  try {
    // Atomic transaction for deducting credits
    await checkAndDeductCredits(userId, "edit", projectId);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Insufficient credits" }, { status: 402 });
  }

  const timestamp = admin.firestore.FieldValue.serverTimestamp();

  // Create Job
  await jobRef.set({
    id: jobRef.id,
    userId,
    projectId,
    type: JobType.EDIT,
    status: JobStatus.PENDING,
    prompt: validPrompt,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // Create Chat Message
  await chatMessageRef.set({
    id: chatMessageRef.id,
    projectId,
    prompt: validPrompt,
    status: "PENDING",
    jobId: jobRef.id,
    createdAt: timestamp,
  });

  const jobId = jobRef.id;
  const chatMessageId = chatMessageRef.id;

  // 9. Enqueue BullMQ edit job (Req 8.4)
  await generationQueue.add(jobId, {
    jobId,
    userId,
    projectId,
    type: "edit",
    prompt: validPrompt,
    currentVersionId: latestVersionId,
    includeImageGeneration: false,
  });

  return NextResponse.json({ jobId, chatMessageId }, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET — Return all chat messages in chronological order (Req 8.5)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { projectId } = params;

  // Verify ownership
  if (!(await verifyOwnership(projectId, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const messagesSnap = await db
    .collection("chatMessages")
    .where("projectId", "==", projectId)
    .orderBy("createdAt", "asc")
    .get();

  const messages = messagesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id,
      prompt: data.prompt,
      status: data.status,
      jobId: data.jobId,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    };
  });

  return NextResponse.json(messages);
}
