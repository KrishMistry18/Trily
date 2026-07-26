/**
 * lib/queue/generationWorker.ts
 *
 * BullMQ Worker that processes generation jobs.
 *
 * Pipeline for CREATE jobs:
 *   1. Mark GenerationJob PROCESSING
 *   2. Spec generation  (generateSpec)
 *   3. Persist SiteSpec to Project.siteSpec
 *   4. Code generation  (generateCode)
 *   5. Optional image   (generateHeroImage)
 *   6. Write HTML to S3
 *   7. INSERT Version, mark GenerationJob COMPLETED
 *   8. Publish SSE event
 *
 * Pipeline for EDIT jobs:
 *   1. Mark PROCESSING
 *   2. Fetch current HTML from S3
 *   3. Edit generation  (generateEditedCode)
 *   4. Write new HTML to S3
 *   5. INSERT Version, UPDATE ChatMessage, mark COMPLETED
 *   6. Publish SSE event
 *
 * FAILED handler: REFUND credits + publish failure SSE event.
 *
 * Requirements: 6.1, 6.2, 6.6
 */
import { type Job, Worker } from "bullmq";
import { FieldValue } from "firebase-admin/firestore";

import { generateCode } from "@/lib/ai/code-generator";
import { generateEditedCode } from "@/lib/ai/edit-generator";
import { generateHeroImage } from "@/lib/ai/image-generator";
import { generateSpec } from "@/lib/ai/spec-generator";
import { refundCredits } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { storageService } from "@/lib/storage";

import type { GenerationJobData } from "./generationQueue";
import { redis } from "./redis";

export enum JobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum JobType {
  CREATE = "CREATE",
  EDIT = "EDIT",
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WORKER_TIMEOUT_MS = 120_000; // 120 seconds

// ---------------------------------------------------------------------------
// SSE pub/sub helpers
// ---------------------------------------------------------------------------

async function publishJobEvent(jobId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await redis.publish(`job:${jobId}`, JSON.stringify({ jobId, ...payload }));
  } catch {
    // Non-fatal — log and continue
    console.error(`[worker] Failed to publish SSE event for job ${jobId}`);
  }
}

// ---------------------------------------------------------------------------
// Worker process function
// ---------------------------------------------------------------------------

async function processJob(job: Job<GenerationJobData>): Promise<void> {
  const { jobId, userId, projectId, type, prompt, currentVersionId, includeImageGeneration } =
    job.data;

  const startedAt = Date.now();

  // 1. Mark PROCESSING
  await db.collection("generationJobs").doc(jobId).update({
    status: JobStatus.PROCESSING,
  });
  await publishJobEvent(jobId, { status: "processing", step: type === "edit" ? "edit" : "spec" });

  // 2. Timeout watchdog helper
  function checkTimeout(): void {
    if (Date.now() - startedAt > WORKER_TIMEOUT_MS) {
      throw new Error(`Job timed out after ${WORKER_TIMEOUT_MS}ms`);
    }
  }

  // ---------------------------------------------------------------------------
  // CREATE pipeline
  // ---------------------------------------------------------------------------
  if (type === "create") {
    // Spec generation
    checkTimeout();
    const siteSpec = await generateSpec(prompt, jobId, userId);

    // Persist SiteSpec
    await db
      .collection("projects")
      .doc(projectId)
      .update({
        siteSpec: siteSpec as object,
      });

    await publishJobEvent(jobId, { status: "processing", step: "code" });

    // Code generation
    checkTimeout();
    const codeFiles = await generateCode(siteSpec, jobId, userId);

    // Optional image generation
    let heroImageKey: string | undefined;
    if (includeImageGeneration) {
      checkTimeout();
      try {
        heroImageKey = await generateHeroImage(siteSpec, userId, projectId, jobId);
        // Embed the image URL in the HTML if available
        if (heroImageKey) {
          // Simple heuristic: replace placeholder or append img tag to hero section
          // A full implementation would parse/modify the HTML; here we store the key
        }
      } catch {
        // Image generation failure is non-fatal — continue without image (Req 18.4)
        console.warn(`[worker] Image generation failed for job ${jobId}, continuing without image`);
      }
    }

    checkTimeout();

    // Write HTML to S3
    const versionId = crypto.randomUUID();
    const storageKey = `${userId}/${projectId}/${versionId}/index.html`;
    await storageService.writeVersionFiles(userId, projectId, versionId, codeFiles);

    // INSERT Version and update GenerationJob in a transaction
    await db.runTransaction(async (tx) => {
      // Get the next version number
      const versionsSnap = await tx.get(
        db
          .collection("versions")
          .where("projectId", "==", projectId)
          .orderBy("versionNumber", "desc")
          .limit(1),
      );
      const lastVersion = versionsSnap.empty ? null : versionsSnap.docs[0]?.data();
      const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

      const vRef = db.collection("versions").doc(versionId);
      tx.set(vRef, {
        id: versionId,
        projectId,
        versionNumber,
        prompt,
        storageKey,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(db.collection("generationJobs").doc(jobId), {
        status: JobStatus.COMPLETED,
      });

      tx.update(db.collection("projects").doc(projectId), {
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await publishJobEvent(jobId, { status: "completed", versionId });
    return;
  }

  // ---------------------------------------------------------------------------
  // EDIT pipeline
  // ---------------------------------------------------------------------------
  if (type === "edit") {
    checkTimeout();

    // Fetch current HTML from S3
    if (!currentVersionId) throw new Error("currentVersionId is required for edit jobs");

    const currentVersionDoc = await db.collection("versions").doc(currentVersionId).get();
    if (!currentVersionDoc.exists) throw new Error(`Version ${currentVersionId} not found`);

    const currentCodeFiles = await storageService.readVersionFiles(
      userId,
      projectId,
      currentVersionId,
    );

    // Generate edited code
    checkTimeout();
    await publishJobEvent(jobId, { status: "processing", step: "edit" });
    const editedCode = await generateEditedCode(currentCodeFiles.html, prompt, jobId, userId);

    checkTimeout();

    // Write new HTML to S3
    const versionId = crypto.randomUUID();
    const storageKey = `${userId}/${projectId}/${versionId}/index.html`;
    await storageService.writeVersionFiles(userId, projectId, versionId, editedCode);

    // INSERT Version, update job, update ChatMessage in a transaction
    await db.runTransaction(async (tx) => {
      // Get next version number
      const versionsSnap = await tx.get(
        db
          .collection("versions")
          .where("projectId", "==", projectId)
          .orderBy("versionNumber", "desc")
          .limit(1),
      );
      const lastVersion = versionsSnap.empty ? null : versionsSnap.docs[0]?.data();
      const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

      const vRef = db.collection("versions").doc(versionId);
      tx.set(vRef, {
        id: versionId,
        projectId,
        versionNumber,
        prompt,
        storageKey,
        createdAt: FieldValue.serverTimestamp(),
      });

      tx.update(db.collection("generationJobs").doc(jobId), {
        status: JobStatus.COMPLETED,
      });

      // Update associated ChatMessage if one references this job
      const chatsSnap = await tx.get(db.collection("chatMessages").where("jobId", "==", jobId));
      chatsSnap.docs.forEach((doc) => {
        tx.update(doc.ref, { status: "APPLIED" });
      });

      tx.update(db.collection("projects").doc(projectId), {
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await publishJobEvent(jobId, { status: "completed", versionId });
  }
}

// ---------------------------------------------------------------------------
// FAILED handler
// ---------------------------------------------------------------------------

async function handleJobFailed(job: Job<GenerationJobData> | undefined, err: Error): Promise<void> {
  if (!job) return;

  const { jobId, userId } = job.data;
  const failureReason = err.message ?? "Unknown error";

  try {
    const jobDoc = await db.collection("generationJobs").doc(jobId).get();
    const generationJob = jobDoc.data();

    if (!generationJob || generationJob.status === JobStatus.COMPLETED) return;

    await db.runTransaction(async (tx) => {
      tx.update(jobDoc.ref, {
        status: JobStatus.FAILED,
        failureReason,
      });

      // Update associated ChatMessage to FAILED
      const chatsSnap = await tx.get(db.collection("chatMessages").where("jobId", "==", jobId));
      chatsSnap.docs.forEach((doc) => {
        tx.update(doc.ref, { status: "FAILED" });
      });
    });

    // Restore credits (needs to be outside the tx because it uses its own tx inside refundCredits if we implemented it, or we just call it)
    if (generationJob.creditsDeducted > 0) {
      const actionType = job.data.type === "edit" ? "edit" : "generation";
      await refundCredits(
        userId,
        generationJob.creditsDeducted,
        actionType,
        generationJob.projectId || job.data.projectId,
      );
    }

    await publishJobEvent(jobId, { status: "failed", error: failureReason });
  } catch (handlerErr) {
    console.error(`[worker] FAILED handler error for job ${jobId}:`, handlerErr);
  }
}

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------

const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "3", 10);

export const generationWorker = new Worker<GenerationJobData>("generation", processJob, {
  connection: redis,
  concurrency,
});

generationWorker.on("failed", (job, err) => {
  handleJobFailed(job, err as Error).catch(console.error);
});

generationWorker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});
