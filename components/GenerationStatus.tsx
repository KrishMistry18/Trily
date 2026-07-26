"use client";

/**
 * components/GenerationStatus.tsx
 *
 * Displays generation job progress with spinner and status labels.
 * Requirements: 6.3, 6.4, 6.5
 */

import { useJobStatus } from "@/hooks/useJobStatus";

interface GenerationStatusProps {
  jobId: string | null;
  onComplete?: (versionId: string) => void;
  onRetry?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending…",
  processing: "Generating your site…",
  completed: "Complete!",
  failed: "Generation failed",
};

function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className} text-primary`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function GenerationStatus({ jobId, onComplete, onRetry }: GenerationStatusProps) {
  const { status, versionId, error, isLoading } = useJobStatus(jobId);

  // Trigger onComplete callback when job completes
  if (status === "completed" && versionId && onComplete) {
    onComplete(versionId);
  }

  if (!jobId || !status) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-3" role="status" aria-live="polite">
      {isLoading && <Spinner />}
      {status === "completed" && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-xs" aria-hidden="true">
          ✓
        </span>
      )}
      {status === "failed" && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs" aria-hidden="true">
          ✕
        </span>
      )}

      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          {STATUS_LABELS[status] ?? status}
        </p>
        {status === "failed" && (error || true) && (
          <p className="text-xs text-red-500 mt-0.5">{error ?? "An unexpected error occurred."}</p>
        )}
      </div>

      {status === "failed" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-medium text-primary hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
