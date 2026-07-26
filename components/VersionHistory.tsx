"use client";

/**
 * components/VersionHistory.tsx
 *
 * Version history list with View and Revert actions.
 * Requirements: 9.1, 9.2, 9.3
 */

import { useEffect, useState } from "react";

interface Version {
  id: string;
  versionNumber: number;
  prompt: string | null;
  createdAt: string;
  deployUrl: string | null;
}

interface VersionHistoryProps {
  projectId: string;
  currentVersionId: string | null;
  onView: (versionId: string, html: string) => void;
  onRevert?: (newVersionId: string) => void;
}

export default function VersionHistory({ projectId, currentVersionId, onView, onRevert }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/versions`)
      .then((r) => r.json())
      .then((data: Version[]) => setVersions(data.reverse())) // newest first
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  async function handleView(versionId: string) {
    const res = await fetch(`/api/projects/${projectId}/versions/${versionId}`);
    if (!res.ok) return;
    const data = (await res.json()) as { presignedUrl?: string };
    if (data.presignedUrl) {
      const html = await fetch(data.presignedUrl).then((r) => r.text()).catch(() => "");
      onView(versionId, html);
    }
  }

  async function handleRevert(versionId: string) {
    setRevertingId(versionId);
    setConfirmId(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${versionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert" }),
      });
      if (res.ok) {
        const newVersion = (await res.json()) as Version;
        setVersions((prev) => [newVersion, ...prev]);
        onRevert?.(newVersion.id);
      }
    } finally {
      setRevertingId(null);
    }
  }

  if (loading) {
    return <p className="text-xs text-center text-foreground/40 py-8">Loading versions…</p>;
  }

  if (versions.length === 0) {
    return <p className="text-xs text-center text-foreground/40 py-8">No versions yet</p>;
  }

  return (
    <div className="space-y-2 px-1">
      {versions.map((v) => {
        const isCurrent = v.id === currentVersionId;
        return (
          <div
            key={v.id}
            className={`rounded-lg border p-3 text-sm transition ${
              isCurrent ? "border-primary/40 bg-primary/5" : "border-foreground/10 bg-background"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">v{v.versionNumber}</span>
                  {isCurrent && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white font-medium">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-foreground/50 mt-0.5">
                  {new Date(v.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
                {v.prompt && (
                  <p className="text-xs text-foreground/60 mt-1 truncate" title={v.prompt}>
                    {v.prompt.slice(0, 60)}{v.prompt.length > 60 ? "…" : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleView(v.id)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View
                </button>
                {!isCurrent && (
                  confirmId === v.id ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleRevert(v.id)}
                        disabled={revertingId === v.id}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        {revertingId === v.id ? "…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="text-xs text-foreground/40 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(v.id)}
                      className="text-xs font-medium text-foreground/50 hover:text-foreground hover:underline"
                    >
                      Revert
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
