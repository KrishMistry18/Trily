/**
 * app/api/projects/route.ts
 *
 * POST  /api/projects — Create a new project and enqueue a generation job.
 * GET   /api/projects — List all projects for the authenticated user.
 *
 * Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 6.1, 12.1, 9.4
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { JobStatus, JobType } from "@/types";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { checkAndDeductCredits, getCreditsBalance } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { generationQueue } from "@/lib/queue/generationQueue";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  PROMPT_MAX_LENGTH,
  PROMPT_MIN_LENGTH,
  validatePromptLength,
} from "@/lib/validation/prompt";

// ---------------------------------------------------------------------------
// POST /api/projects — Create project
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // 2. Rate limit check (Req 3.3)
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

  // 3. Parse and validate body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, includeImageGeneration = false } = body as {
    prompt: unknown;
    includeImageGeneration?: boolean;
  };

  // 4. Validate prompt length (Req 3.5)
  const promptError = validatePromptLength(prompt);
  if (promptError) {
    return NextResponse.json({ error: promptError }, { status: 400 });
  }

  const validPrompt = prompt as string;

  // 5. Check credit balance (Req 3.4)
  const balance = await getCreditsBalance(userId);
  if (balance <= 0) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // 6. Deduct credits and create DB records (Req 3.6, 6.1)
  const projectRef = db.collection("projects").doc();
  const jobRef = db.collection("generationJobs").doc();

  try {
    // This function runs an atomic transaction on the user's credit balance
    // and creates a transaction log document. It will throw if balance < cost.
    await checkAndDeductCredits(userId, "generation", projectRef.id);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Insufficient credits" }, { status: 402 });
  }

  // Create project
  await projectRef.set({
    projectId: projectRef.id,
    ownerId: userId,
    name: validPrompt.slice(0, 80),
    prompt: validPrompt,
    status: "draft",
    currentVersionId: "",
    thumbnailUrl: "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Create generation job (PENDING)
  await jobRef.set({
    id: jobRef.id,
    userId,
    projectId: projectRef.id,
    type: JobType.CREATE,
    status: JobStatus.PENDING,
    prompt: validPrompt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const projectId = projectRef.id;
  const jobId = jobRef.id;

  // 7. Enqueue BullMQ job (Req 6.1)
  await generationQueue.add(jobId, {
    jobId,
    userId,
    projectId,
    type: "create",
    prompt: validPrompt,
    includeImageGeneration: Boolean(includeImageGeneration),
  });

  // 8. Return within 2 seconds (Req 3.3)
  return NextResponse.json({ projectId, jobId, status: "pending" }, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET /api/projects — List projects (Req 12.1)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const projectsSnap = await db
    .collection("projects")
    .where("ownerId", "==", userId)
    .orderBy("updatedAt", "desc")
    .get();

  const projects = [];
  for (const doc of projectsSnap.docs) {
    const p = doc.data();

    // Fetch latest version for this project
    const versionsSnap = await db
      .collection("versions")
      .where("projectId", "==", doc.id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    let latestVersion = null;
    if (!versionsSnap.empty) {
      const v = versionsSnap.docs[0]?.data();
      if (v) {
        latestVersion = {
          versionId: v.versionId,
          projectId: v.projectId,
          createdAt: v.createdAt,
        };
      }
    }

    projects.push({
      id: p.projectId,
      name: p.name,
      prompt: p.prompt,
      thumbnailUrl: p.thumbnailUrl,
      createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt,
      updatedAt: p.updatedAt?.toDate ? p.updatedAt.toDate() : p.updatedAt,
      latestVersion,
    });
  }

  return NextResponse.json(projects);
}
