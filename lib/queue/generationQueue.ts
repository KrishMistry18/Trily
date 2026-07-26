/**
 * lib/queue/generationQueue.ts
 *
 * BullMQ Queue instance for generation jobs.
 * All jobs (CREATE and EDIT) are added to the "generation" queue.
 *
 * Requirements: 6.1, 6.2
 */

import { Queue, type JobsOptions } from "bullmq";
import { redis } from "./redis";

// ---------------------------------------------------------------------------
// Job data shape
// ---------------------------------------------------------------------------

export interface GenerationJobData {
  jobId: string;         // DB GenerationJob.id
  userId: string;
  projectId: string;
  type: "create" | "edit";
  prompt: string;
  currentVersionId?: string; // for edit jobs
  includeImageGeneration: boolean;
}

// ---------------------------------------------------------------------------
// Default BullMQ job options
// ---------------------------------------------------------------------------

export const JOB_OPTIONS: JobsOptions = {
  attempts: 1,           // retries are managed inside the worker
  removeOnComplete: 100,
  removeOnFail: 500,
  // 130 s BullMQ hard timeout — 10 s grace over the 120 s app-level watchdog
  timeout: 130_000,
};

// ---------------------------------------------------------------------------
// Queue instance
// ---------------------------------------------------------------------------

export const generationQueue = new Queue<GenerationJobData>("generation", {
  connection: redis,
  defaultJobOptions: JOB_OPTIONS,
});
