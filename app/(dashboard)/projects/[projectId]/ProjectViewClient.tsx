"use client";

import { useState } from "react";

import { updateProjectThumbnailAction } from "@/app/actions/dashboard";
import { getProjectVersionAction } from "@/app/actions/project";
import { saveAs } from "file-saver";
import JSZip from "jszip";

import EditChatInput from "@/components/EditChatInput";
import PreviewPanel from "@/components/PreviewPanel";
import PublishDialog from "@/components/PublishDialog";
import VersionHistory from "@/components/VersionHistory";

interface ProjectViewClientProps {
  projectId: string;
  initialHtml: string | null;
  initialActiveVersionId: string;
}

export default function ProjectViewClient({
  projectId,
  initialHtml,
  initialActiveVersionId,
}: ProjectViewClientProps) {
  const [html, setHtml] = useState<string | null>(initialHtml);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(initialActiveVersionId);
  const [currentPreviewId, setCurrentPreviewId] = useState<string | null>(initialActiveVersionId);
  const [isLoading, setIsLoading] = useState(!initialHtml);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);

  // Called when clicking a version in the sidebar to just preview it
  async function handlePreviewChange(versionId: string) {
    if (versionId === currentPreviewId) return;

    setIsLoading(true);
    try {
      const newHtml = await getProjectVersionAction(projectId, versionId);
      if (newHtml) {
        setHtml(newHtml);
        setCurrentPreviewId(versionId);
      }
    } catch (error) {
      console.error("Failed to fetch version", error);
    } finally {
      setIsLoading(false);
    }
  }

  // Called after a successful edit, or a successful restore
  async function handleNewActiveVersion(newVersionId: string) {
    setIsLoading(true);
    try {
      const newHtml = await getProjectVersionAction(projectId, newVersionId);
      if (newHtml) {
        setHtml(newHtml);
        setActiveVersionId(newVersionId);
        setCurrentPreviewId(newVersionId);
      }
    } catch (error) {
      console.error("Failed to fetch new version", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleScreenshotCapture(dataUrl: string) {
    try {
      await updateProjectThumbnailAction(projectId, dataUrl);
    } catch (e) {
      console.error("Failed to update thumbnail", e);
    }
  }

  function handleDownloadZip() {
    if (!html) return;
    const zip = new JSZip();
    zip.file("index.html", html);
    zip.generateAsync({ type: "blob" }).then(function (content) {
      saveAs(content, `project-${projectId}.zip`);
    });
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Left Main Area: Preview + Chat Input */}
      <div className="flex-1 flex flex-col min-w-0 gap-4">
        {/* Preview Panel */}
        <div className="flex-1 overflow-hidden">
          <PreviewPanel
            html={html}
            isLoading={isLoading}
            onScreenshotCapture={handleScreenshotCapture}
            onPublishClick={() => setIsPublishDialogOpen(true)}
            onDownloadZip={handleDownloadZip}
          />
        </div>

        {/* Chat Input Area (only enabled if we are viewing the active version) */}
        <div className="shrink-0">
          <EditChatInput
            projectId={projectId}
            activeVersionId={activeVersionId || ""}
            onEditComplete={handleNewActiveVersion}
            disabled={activeVersionId !== currentPreviewId} // Disable editing past versions without restoring first
          />
        </div>
      </div>

      {/* Right Sidebar: Version History */}
      <div className="w-full md:w-80 flex-shrink-0 flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm h-64 md:h-auto">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="font-semibold text-sm">Version History</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          <VersionHistory
            projectId={projectId}
            activeVersionId={activeVersionId || ""}
            currentPreviewId={currentPreviewId || ""}
            onPreviewChange={handlePreviewChange}
            onVersionRestored={handleNewActiveVersion}
          />
        </div>
      </div>

      <PublishDialog
        projectId={projectId}
        isOpen={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
      />
    </div>
  );
}
