/**
 * app/api/projects/[projectId]/chat/route.ts
 *
 * POST /api/projects/:projectId/chat  — Submit an edit prompt.
 * GET  /api/projects/:projectId/chat  — Return all chat messages (chronological).
 *
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6
 */

import { auth } from "@/auth";
import { getCreditBalance } from "@/lib/billing/credits";
import { CREDIT_COSTS } from "@/lib/billing/config";
import { db } from "@/lib/db";
import { generationQueue } from "@/lib/queue/generationQueue";
import { checkRateLimit } from "@/lib/rate-limit";
import { CreditEventType, JobStatus, JobType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

// Re-export validation helpers so property tests can import from one place
export {
  EDIT_PROMPT_MIN_LENGTH,
  EDIT_PROMPT_MAX_LENGTH,
  validateEditPromptLength,
} from "@/lib/validation/prompt";

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
// POST — Submit edit prompt (Req 8.1, 8.2, 8.4, 8.6)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
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
      }
    );
  }

  // 6. Check credit balance
  const balance = await getCreditBalance(userId);
  if (balance <= 0) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // 7. Fetch latest version for the project (needed by the worker)
  const latestVersion = await db.version.findFirst({
    where: { projectId },
    orderBy: { versionNumber: "desc" },
    select: { id: true },
  });

  // 8. DB transaction: INSERT ChatMessage + GenerationJob + CreditLedger DEDUCTION
  const { jobId, chatMessageId } = await db.$transaction(async (tx) => {
    // Insert ChatMessage (PENDING)
    const chatMessage = await tx.chatMessage.create({
      data: {
        projectId,
        prompt: validPrompt,
        status: "PENDING",
      },
    });

    // Insert GenerationJob (EDIT, PENDING)
    const job = await tx.generationJob.create({
      data: {
        userId,
        projectId,
        type: JobType.EDIT,
        status: JobStatus.PENDING,
        prompt: validPrompt,
        creditsDeducted: CREDIT_COSTS.EDIT_JOB,
      },
    });

    // Link chat message to job
    await tx.chatMessage.update({
      where: { id: chatMessage.id },
      data: { jobId: job.id },
    });

    // Insert CreditLedger DEDUCTION
    const latestLedger = await tx.creditLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const balanceAfter = (latestLedger?.balanceAfter ?? 0) - CREDIT_COSTS.EDIT_JOB;

    await tx.creditLedger.create({
      data: {
        userId,
        eventType: CreditEventType.DEDUCTION,
        amount: CREDIT_COSTS.EDIT_JOB,
        balanceAfter,
        generationJobId: job.id,
      },
    });

    return { jobId: job.id, chatMessageId: chatMessage.id };
  });

  // 9. Enqueue BullMQ edit job (Req 8.4)
  await generationQueue.add(jobId, {
    jobId,
    userId,
    projectId,
    type: "edit",
    prompt: validPrompt,
    currentVersionId: latestVersion?.id,
    includeImageGeneration: false,
  });

  return NextResponse.json({ jobId, chatMessageId }, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET — Return all chat messages in chronological order (Req 8.5)
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
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

  const messages = await db.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      prompt: true,
      status: true,
      jobId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(messages);
}
