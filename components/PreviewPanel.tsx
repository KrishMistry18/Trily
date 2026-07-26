"use client";

/**
 * components/PreviewPanel.tsx
 *
 * Sandboxed iframe preview with resizable width control.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 16.1, 19.3
 */
import { useEffect, useRef, useState } from "react";

interface PreviewPanelProps {
  html: string | null;
  isLoading?: boolean;
  onScreenshotCapture?: (dataUrl: string) => void;
  onPublishClick?: () => void;
  onDownloadZip?: () => void;
}

const MIN_WIDTH = 320;

export default function PreviewPanel({
  html,
  isLoading = false,
  onScreenshotCapture,
  onPublishClick,
  onDownloadZip,
}: PreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState(1200);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Inject html2canvas script
  const injectedHtml = html
    ? html.replace(
        "</body>",
        `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
     <script>
       window.addEventListener('message', (e) => {
         if (e.data === 'take-screenshot') {
           setTimeout(() => {
             if (window.html2canvas) {
               window.html2canvas(document.body, { scale: 0.5 }).then(canvas => {
                 window.parent.postMessage({ type: 'screenshot', dataUrl: canvas.toDataURL('image/jpeg', 0.5) }, '*');
               }).catch(err => console.error("Screenshot error:", err));
             }
           }, 1000); // Wait for fonts/images to load
         }
       });
     </script>
     </body>`,
      )
    : null;

  // Set up message listener for screenshot
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "screenshot" && e.data.dataUrl && onScreenshotCapture) {
        onScreenshotCapture(e.data.dataUrl);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onScreenshotCapture]);

  // Trigger screenshot when html changes (after a delay)
  useEffect(() => {
    if (injectedHtml && !isLoading) {
      const timer = setTimeout(() => {
        const iframe = document.querySelector("iframe");
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage("take-screenshot", "*");
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [injectedHtml, isLoading]);

  // Set initial max width from container
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setMaxWidth(containerRef.current.clientWidth);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const effectiveWidth = viewportWidth ?? maxWidth;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-foreground/5 rounded-xl overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b border-foreground/10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-foreground/50">Width</span>
          <input
            type="range"
            min={MIN_WIDTH}
            max={maxWidth}
            value={effectiveWidth}
            onChange={(e) => setViewportWidth(Number(e.target.value))}
            className="flex-1 h-1.5 accent-primary"
            aria-label="Preview viewport width"
          />
          <span className="text-xs tabular-nums text-foreground/50 w-16 text-right">
            {effectiveWidth}px
          </span>
          {viewportWidth !== null && (
            <button
              type="button"
              onClick={() => setViewportWidth(null)}
              className="text-xs text-primary hover:underline"
            >
              Reset
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Export Dropdown */}
          <div className="relative ml-2">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-sm"
            >
              Export
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {isExportMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsExportMenuOpen(false)}
                ></div>
                <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-foreground/10 shadow-md rounded-md z-20 overflow-hidden text-sm">
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      onDownloadZip?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted transition flex items-center gap-2 text-foreground"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                    Download ZIP
                  </button>
                  <button
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      onPublishClick?.();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-muted transition flex items-center gap-2 text-foreground"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                      <path d="M2 12h20" />
                    </svg>
                    Publish Site
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View Modes */}
          <div className="flex items-center bg-foreground/5 rounded-md p-0.5 ml-2">
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${viewMode === "preview" ? "bg-white shadow-sm text-foreground" : "text-foreground/60 hover:text-foreground"}`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode("code")}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${viewMode === "code" ? "bg-white shadow-sm text-foreground" : "text-foreground/60 hover:text-foreground"}`}
            >
              Code
            </button>
          </div>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto flex justify-center bg-foreground/5 p-4">
        <div style={{ width: effectiveWidth, minWidth: MIN_WIDTH }} className="h-full">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-lg bg-background border border-foreground/10">
              <div className="flex flex-col items-center gap-3 text-foreground/40">
                <svg
                  className="animate-spin h-8 w-8 text-primary"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <p className="text-sm">Generating your site…</p>
              </div>
            </div>
          ) : html ? (
            viewMode === "preview" ? (
              // Req 7.1: sandbox="allow-scripts" — allow-same-origin deliberately excluded
              // Req 16.1: minimum sandbox attribute set
              <iframe
                title="Site preview"
                sandbox="allow-scripts"
                srcDoc={injectedHtml || html}
                className="w-full h-full min-h-[600px] rounded-lg border border-foreground/10 bg-white"
                style={{ colorScheme: "normal" }}
              />
            ) : (
              <div className="w-full h-full min-h-[600px] rounded-lg border border-foreground/10 bg-[#1e1e1e] text-[#d4d4d4] overflow-auto p-4 text-sm font-mono whitespace-pre text-left">
                {html}
              </div>
            )
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg bg-background border border-foreground/10 border-dashed">
              <p className="text-sm text-foreground/40">Your preview will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
