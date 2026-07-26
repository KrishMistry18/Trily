/**
 * app/api/projects/route.ts
 *
 * POST  /api/projects — Create a new project and enqueue a generation job.
 * GET   /api/projects — List all projects for the authenticated user.
 *
 * Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 6.1, 12.1, 9.4
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
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  validatePromptLength,
} from "@/lib/validation/prompt";

// ---------------------------------------------------------------------------
// POST /api/projects — Create project
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Authenticate (Req 3.1)
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
      }
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
    return NextResponse.json(
      { error: "Insufficient credits" },
      { status: 402 }
    );
  }

  // 6. DB transaction: INSERT Project + GenerationJob + CreditLedger DEDUCTION (Req 3.6, 6.1)
  const { projectId, jobId } = await db.$transaction(async (tx) => {
    // Create project
    const project = await tx.project.create({
      data: {
        userId,
        name: validPrompt.slice(0, 80), // use first 80 chars of prompt as name
        prompt: validPrompt,
      },
    });

    // Create generation job (PENDING)
    const job = await tx.generationJob.create({
      data: {
        userId,
        projectId: project.id,
        type: JobType.CREATE,
        status: JobStatus.PENDING,
        prompt: validPrompt,
        creditsDeducted: CREDIT_COSTS.CREATE_JOB,
      },
    });

    // Insert CreditLedger DEDUCTION
    const currentBalance = await tx.creditLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const balanceAfter = (currentBalance?.balanceAfter ?? 0) - CREDIT_COSTS.CREATE_JOB;

    await tx.creditLedger.create({
      data: {
        userId,
        eventType: CreditEventType.DEDUCTION,
        amount: CREDIT_COSTS.CREATE_JOB,
        balanceAfter,
        generationJobId: job.id,
      },
    });

    return { projectId: project.id, jobId: job.id };
  });

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
  return NextResponse.json(
    { projectId, jobId, status: "pending" },
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/projects — List projects (Req 12.1)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const projects = await db.project.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          storageKey: true,
          deployUrl: true,
          createdAt: true,
        },
      },
    },
  });

  const result = projects.map((p) => ({
    id: p.id,
    name: p.name,
    prompt: p.prompt,
    thumbnailUrl: p.thumbnailUrl,
    totalCreditsUsed: p.totalCreditsUsed,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    latestVersion: p.versions[0] ?? null,
  }));

  return NextResponse.json(result);
}
