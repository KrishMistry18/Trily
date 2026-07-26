"use client";

/**
 * components/EditorToolbar.tsx
 *
 * Export ZIP and Deploy to Vercel buttons.
 * Requirements: 10.1, 10.4, 11.1, 11.2, 11.3, 11.4
 */

import { useState } from "react";

interface EditorToolbarProps {
  projectId: string;
}

export default function EditorToolbar({ projectId }: EditorToolbarProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Export timed out. Please try again.")), 5000)
    );

    try {
      const res = await Promise.race([
        fetch(`/api/projects/${projectId}/export`, { method: "POST" }),
        timeout,
      ]) as Response;

      if (!res.ok) {
        throw new Error("Export failed. Please try again.");
      }

      const { downloadUrl } = (await res.json()) as { downloadUrl: string };

      // Trigger browser download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `site-export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeploy() {
    setIsDeploying(true);
    setDeployError(null);
    setDeployUrl(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/deploy`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Deployment failed");
      }
      const { deployUrl: url } = (await res.json()) as { deployUrl: string };
      setDeployUrl(url);
    } catch (err) {
      setDeployError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Export ZIP */}
      <div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/20 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/5 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Exporting…
            </>
          ) : (
            <>
              <span aria-hidden="true">↓</span>
              Export ZIP
            </>
          )}
        </button>
        {exportError && <p className="mt-1 text-xs text-red-500">{exportError}</p>}
      </div>

      {/* Deploy to Vercel */}
      <div>
        <button
          type="button"
          onClick={handleDeploy}
          disabled={isDeploying}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:bg-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isDeploying ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Deploying…
            </>
          ) : (
            <>
              <span aria-hidden="true">▲</span>
              Deploy to Vercel
            </>
          )}
        </button>
        {deployUrl && (
          <a
            href={deployUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-xs text-primary hover:underline truncate max-w-[200px]"
          >
            {deployUrl}
          </a>
        )}
        {deployError && <p className="mt-1 text-xs text-red-500">{deployError}</p>}
      </div>
    </div>
  );
}
