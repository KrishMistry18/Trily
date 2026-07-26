"use client";

/**
 * app/(dashboard)/projects/[projectId]/page.tsx
 *
 * Project editor page — two-panel layout with preview and sidebar.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 16.1, 16.2, 19.3
 */

import ChatPanel from "@/components/ChatPanel";
import EditorToolbar from "@/components/EditorToolbar";
import GenerationStatus from "@/components/GenerationStatus";
import PreviewPanel from "@/components/PreviewPanel";
import VersionHistory from "@/components/VersionHistory";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type SidebarTab = "chat" | "versions";

interface ProjectEditorProps {
  params: { projectId: string };
}

function ProjectEditorInner({ params }: ProjectEditorProps) {
  const { projectId } = params;
  const searchParams = useSearchParams();
  const initialJobId = searchParams.get("jobId");

  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [html, setHtml] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(!!initialJobId);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");

  // Load latest version on mount
  useEffect(() => {
    if (initialJobId) return; // wait for generation to complete
    fetch(`/api/projects/${projectId}/versions`)
      .then((r) => r.json())
      .then(async (versions: Array<{ id: string; presignedUrl?: string }>) => {
        const latest = versions[versions.length - 1];
        if (latest) {
          setCurrentVersionId(latest.id);
          // Fetch HTML via the version detail endpoint
          const vRes = await fetch(`/api/projects/${projectId}/versions/${latest.id}`);
          const vData = await vRes.json() as { presignedUrl?: string };
          if (vData.presignedUrl) {
            const h = await fetch(vData.presignedUrl).then((r) => r.text()).catch(() => null);
            setHtml(h);
          }
        }
      })
      .catch(() => {});
  }, [projectId, initialJobId]);

  async function handleVersionComplete(versionId: string) {
    setIsGenerating(false);
    setJobId(null);
    setCurrentVersionId(versionId);
    // Load the new HTML
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${versionId}`);
      const data = await res.json() as { presignedUrl?: string };
      if (data.presignedUrl) {
        const h = await fetch(data.presignedUrl).then((r) => r.text());
        setHtml(h);
      }
    } catch {}
  }

  function handleViewVersion(versionId: string, versionHtml: string) {
    setCurrentVersionId(versionId);
    setHtml(versionHtml);
  }

  function handleNewVersion(versionId: string) {
    handleVersionComplete(versionId);
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10 bg-background">
        <div className="flex items-center gap-2">
          {jobId && (
            <GenerationStatus
              jobId={jobId}
              onComplete={handleVersionComplete}
              onRetry={() => { setJobId(null); setIsGenerating(false); }}
            />
          )}
        </div>
        <EditorToolbar projectId={projectId} />
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Left: Preview */}
        <div className="flex-1 overflow-hidden p-3">
          <PreviewPanel html={html} isLoading={isGenerating} />
        </div>

        {/* Right: Sidebar */}
        <div className="w-80 shrink-0 border-l border-foreground/10 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-foreground/10">
            {(["chat", "versions"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs font-medium capitalize transition ${
                  activeTab === tab
                    ? "border-b-2 border-primary text-primary"
                    : "text-foreground/50 hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "chat" ? (
              <ChatPanel
                projectId={projectId}
                isJobInProgress={isGenerating}
                onNewVersion={handleNewVersion}
              />
            ) : (
              <div className="py-3">
                <VersionHistory
                  projectId={projectId}
                  currentVersionId={currentVersionId}
                  onView={handleViewVersion}
                  onRevert={(vid) => handleVersionComplete(vid)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectEditorPage(props: ProjectEditorProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-foreground/40">Loading editor…</div>}>
      <ProjectEditorInner {...props} />
    </Suspense>
  );
}
