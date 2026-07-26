"use client";

import { useEffect, useState } from "react";

import { getProjectVersionsHistoryAction, restoreVersionAction } from "@/app/actions/project";
import { toast } from "sonner";

export interface VersionInfo {
  versionId: string;
  prompt: string;
  createdAt: string;
  parentVersionId: string | null;
}

interface VersionHistoryProps {
  projectId: string;
  activeVersionId: string;
  currentPreviewId: string;
  onPreviewChange: (versionId: string) => void;
  onVersionRestored: (newVersionId: string) => void;
}

export default function VersionHistory({
  projectId,
  activeVersionId,
  currentPreviewId,
  onPreviewChange,
  onVersionRestored,
}: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchVersions() {
    setIsLoading(true);
    try {
      const data = await getProjectVersionsHistoryAction(projectId);
      setVersions(data);
    } catch (error) {
      console.error("Failed to fetch history:", error);
      toast.error("Failed to fetch version history");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchVersions();
  }, [projectId, activeVersionId]);

  async function handleRestore(versionId: string) {
    setIsRestoring(true);
    try {
      const res = await restoreVersionAction(projectId, versionId, activeVersionId);
      if (res.success && res.versionId) {
        onVersionRestored(res.versionId);
        toast.success("Version restored successfully");
      } else {
        toast.error(res.error || "Failed to restore");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error restoring version");
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border overflow-hidden">
      <div className="p-4 border-b border-foreground/10 bg-muted/30 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Version History</h2>
        <span className="text-xs text-muted-foreground bg-foreground/10 px-2 py-0.5 rounded-full">
          {versions.length} {versions.length === 1 ? "version" : "versions"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-6 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="pl-4 border-l-2 border-foreground/10 space-y-2">
                <div className="h-4 bg-foreground/10 rounded w-3/4 animate-pulse"></div>
                <div className="h-3 bg-foreground/5 rounded w-1/2 animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : versions.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground mt-8">No history found.</p>
        ) : (
          versions.map((v, i) => {
            const isActive = v.versionId === activeVersionId;
            const isPreviewing = v.versionId === currentPreviewId;

            return (
              <div
                key={v.versionId}
                className={`relative pl-4 border-l-2 transition-colors ${isPreviewing ? "border-primary" : "border-foreground/20 hover:border-foreground/40"}`}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute -left-[5px] top-1.5 h-2 w-2 rounded-full ${isActive ? "bg-primary" : "bg-foreground/20"}`}
                />

                <button
                  type="button"
                  onClick={() => onPreviewChange(v.versionId)}
                  className="w-full text-left"
                >
                  <p className="text-sm font-medium text-foreground line-clamp-2">
                    {i === versions.length - 1 ? "Initial Generation" : v.prompt}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {isActive && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-primary bg-primary/10 px-1.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                </button>

                {isPreviewing && !isActive && (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={isRestoring}
                      onClick={() => handleRestore(v.versionId)}
                      className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded font-medium disabled:opacity-50"
                    >
                      {isRestoring ? "Restoring..." : "Restore this version"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
