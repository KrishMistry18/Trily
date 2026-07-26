"use client";

/**
 * hooks/useJobStatus.ts
 *
 * SSE client hook for tracking generation job status.
 * Opens an EventSource connection to /api/jobs/{jobId}/status and
 * returns reactive state updated on each SSE event.
 *
 * Requirements: 6.3, 6.4, 6.5
 */

import { useEffect, useState } from "react";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface JobStatusState {
  status: JobStatus | null;
  versionId: string | null;
  error: string | null;
  isLoading: boolean;
}

export function useJobStatus(jobId: string | null): JobStatusState {
  const [state, setState] = useState<JobStatusState>({
    status: null,
    versionId: null,
    error: null,
    isLoading: false,
  });

  useEffect(() => {
    if (!jobId) return;

    setState({ status: "pending", versionId: null, error: null, isLoading: true });

    const eventSource = new EventSource(`/api/jobs/${jobId}/status`);

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          status?: string;
          versionId?: string;
          error?: string;
        };

        const status = (data.status as JobStatus) ?? null;
        setState({
          status,
          versionId: data.versionId ?? null,
          error: data.error ?? null,
          isLoading: status !== "completed" && status !== "failed",
        });

        // Close stream on terminal state
        if (status === "completed" || status === "failed") {
          eventSource.close();
        }
      } catch {
        // Malformed event — ignore
      }
    };

    eventSource.onerror = () => {
      setState((prev) => ({
        ...prev,
        error: "Connection lost. Please refresh.",
        isLoading: false,
      }));
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  return state;
}
