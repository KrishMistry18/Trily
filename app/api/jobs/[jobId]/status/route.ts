/**
 * app/api/jobs/[jobId]/status/route.ts
 *
 * SSE job status endpoint.
 *
 * - Verifies the job belongs to the authenticated user.
 * - If job is already COMPLETED or FAILED, returns the current status immediately as JSON.
 * - Otherwise, opens an SSE stream (text/event-stream) and subscribes to the
 *   Redis pub/sub channel `job:{jobId}`, forwarding events to the client.
 * - Closes the stream when the job reaches a terminal state or the client
 *   disconnects (req.signal aborted).
 *
 * Requirements: 6.3, 6.4, 6.5
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { JobStatus } from "@/types";

import { db } from "@/lib/db";
import redis from "@/lib/queue/redis";

const TERMINAL_STATUSES = new Set<JobStatus>([JobStatus.COMPLETED, JobStatus.FAILED]);

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  // 1. Authenticate
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { jobId } = params;

  // 2. Verify job exists and belongs to the user
  const jobDoc = await db.collection("generationJobs").doc(jobId).get();

  if (!jobDoc.exists) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = jobDoc.data()!;

  if (job.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. If already in terminal state, return immediately as JSON (Req 6.3)
  if (TERMINAL_STATUSES.has(job.status)) {
    return NextResponse.json({
      jobId,
      status: job.status.toLowerCase(),
    });
  }

  // 4. Open SSE stream (Req 6.4, 6.5)
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Create a dedicated subscriber connection (ioredis requires a separate
      // connection in subscribe mode — duplicate the shared client).
      const subscriber = redis.duplicate();

      function sendEvent(data: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller may be closed if client disconnected
        }
      }

      function cleanup() {
        subscriber.unsubscribe().catch(() => {});
        subscriber.disconnect();
      }

      // Subscribe to the job's pub/sub channel
      await subscriber.subscribe(`job:${jobId}`);

      subscriber.on("message", (_channel: string, message: string) => {
        try {
          const payload = JSON.parse(message) as Record<string, unknown>;
          sendEvent(payload);

          // Close stream once terminal status is reached
          const payloadStatus = (payload.status as string | undefined)?.toUpperCase();
          if (payloadStatus === "COMPLETED" || payloadStatus === "FAILED") {
            cleanup();
            try {
              controller.close();
            } catch {
              // already closed
            }
          }
        } catch {
          // Malformed message — ignore
        }
      });

      // Handle client disconnect (Req 6.5)
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });

      // Re-check status after subscribing in case the job completed between
      // our initial check and the subscribe call (avoids missed events).
      const currentJobDoc = await db.collection("generationJobs").doc(jobId).get();

      if (currentJobDoc.exists) {
        const currentJob = currentJobDoc.data()!;
        if (TERMINAL_STATUSES.has(currentJob.status)) {
          sendEvent({ jobId, status: currentJob.status.toLowerCase() });
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
