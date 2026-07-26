/**
 * worker.ts
 *
 * Entry point for the BullMQ worker process.
 * Run this as a separate Node.js process from the Next.js server:
 *
 *   npx tsx worker.ts
 *   # or in production:
 *   node dist/worker.js
 *
 * Requirements: 6.1, 6.2, 6.6
 */

import { generationWorker } from "./lib/queue/generationWorker";

console.log("[worker] Generation worker started");
console.log(`[worker] Concurrency: ${process.env.WORKER_CONCURRENCY ?? 3}`);

// Graceful shutdown on SIGTERM / SIGINT
async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] Received ${signal}, shutting down gracefully...`);
  await generationWorker.close();
  console.log("[worker] Worker closed.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

generationWorker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} (dbId: ${job.data.jobId}) completed`);
});

generationWorker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} (dbId: ${job?.data.jobId}) failed:`, err.message);
});
