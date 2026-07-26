/**
 * app/api/projects/route.ts
 *
 * POST  /api/projects — Create a new project and enqueue a generation job.
 * GET   /api/projects — List all projects for the authenticated user.
 *
 * Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 6.1, 12.1, 9.4
 */
import { NextRequest, NextResponse } from "next/server";

import { JobStatus, JobType } from "@/types";
import * as admin from "firebase-admin";

import { getAuthUserId } from "@/lib/auth-utils";
import { CREDIT_COSTS } from "@/lib/billing/config";
import { getCreditBalance } from "@/lib/billing/credits";
import { CreditEventType } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { generationQueue } from "@/lib/queue/generationQueue";
import { checkRateLimit } from "@/lib/rate-limit";

// Re-export validation helpers so property tests can import from one place
export {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  validatePromptLength,
} from "@/lib/validation/prompt";

// ---------------------------------------------------------------------------
// POST /api/projects — Create project
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Authenticate (Req 3.1)
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const balance = await getCreditBalance(userId);
  if (balance <= 0) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // 6. DB transaction: INSERT Project + GenerationJob + CreditLedger DEDUCTION (Req 3.6, 6.1)
  const projectRef = db.collection("projects").doc();
  const jobRef = db.collection("generationJobs").doc();
  const ledgerRef = db.collection("creditLedgers").doc();

  await db.runTransaction(async (tx) => {
    // Re-check balance inside transaction
    const balanceQuery = db.collection("creditLedgers").where("userId", "==", userId).get();

    const balanceSnap = await tx.get(balanceQuery);
    let currentBalance = 0;
    if (!balanceSnap.empty) {
      const docs = balanceSnap.docs.map((doc) => doc.data());
      docs.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
      currentBalance = docs[0].balanceAfter;
    }

    if (currentBalance < CREDIT_COSTS.CREATE_JOB) {
      throw new Error("Insufficient credits");
    }

    const balanceAfter = currentBalance - CREDIT_COSTS.CREATE_JOB;

    // Create project
    tx.set(projectRef, {
      id: projectRef.id,
      userId,
      name: validPrompt.slice(0, 80),
      prompt: validPrompt,
      totalCreditsUsed: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create generation job (PENDING)
    tx.set(jobRef, {
      id: jobRef.id,
      userId,
      projectId: projectRef.id,
      type: JobType.CREATE,
      status: JobStatus.PENDING,
      prompt: validPrompt,
      creditsDeducted: CREDIT_COSTS.CREATE_JOB,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Insert CreditLedger DEDUCTION
    tx.set(ledgerRef, {
      id: ledgerRef.id,
      userId,
      eventType: CreditEventType.DEDUCTION,
      amount: CREDIT_COSTS.CREATE_JOB,
      balanceAfter,
      generationJobId: jobRef.id,
      stripePaymentId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
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
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectsSnap = await db
    .collection("projects")
    .where("userId", "==", userId)
    .orderBy("updatedAt", "desc")
    .get();

  const projects = [];
  for (const doc of projectsSnap.docs) {
    const p = doc.data();

    // Fetch latest version for this project
    const versionsSnap = await db
      .collection("versions")
      .where("projectId", "==", doc.id)
      .orderBy("versionNumber", "desc")
      .limit(1)
      .get();

    let latestVersion = null;
    if (!versionsSnap.empty) {
      const v = versionsSnap.docs[0].data();
      latestVersion = {
        id: v.id,
        versionNumber: v.versionNumber,
        storageKey: v.storageKey,
        deployUrl: v.deployUrl,
        createdAt: v.createdAt,
      };
    }

    projects.push({
      id: p.id,
      name: p.name,
      prompt: p.prompt,
      thumbnailUrl: p.thumbnailUrl,
      totalCreditsUsed: p.totalCreditsUsed,
      createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt,
      updatedAt: p.updatedAt?.toDate ? p.updatedAt.toDate() : p.updatedAt,
      latestVersion,
    });
  }

  return NextResponse.json(projects);
}
