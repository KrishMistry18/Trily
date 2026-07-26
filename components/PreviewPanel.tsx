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
}

const MIN_WIDTH = 320;

export default function PreviewPanel({ html, isLoading = false }: PreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxWidth, setMaxWidth] = useState(1200);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

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
    <div ref={containerRef} className="flex flex-col h-full bg-foreground/5 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-background border-b border-foreground/10">
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

      {/* Preview area */}
      <div className="flex-1 overflow-auto flex justify-center bg-foreground/5 p-4">
        <div style={{ width: effectiveWidth, minWidth: MIN_WIDTH }} className="h-full">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-lg bg-background border border-foreground/10">
              <div className="flex flex-col items-center gap-3 text-foreground/40">
                <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm">Generating your site…</p>
              </div>
            </div>
          ) : html ? (
            // Req 7.1: sandbox="allow-scripts" — allow-same-origin deliberately excluded
            // Req 16.1: minimum sandbox attribute set
            <iframe
              title="Site preview"
              sandbox="allow-scripts"
              srcDoc={html}
              className="w-full h-full min-h-[600px] rounded-lg border border-foreground/10 bg-white"
              style={{ colorScheme: "normal" }}
            />
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
