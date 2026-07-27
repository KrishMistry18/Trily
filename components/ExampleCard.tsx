"use client";

import React, { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/Button";

import { OfficialExample } from "@/types/db";

export function ExampleCard({ example }: { example: OfficialExample }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(entry.contentRect.width / 1440);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="group flex flex-col rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-white/20 transition-colors shadow-sm">
      {/* Interactive Thumbnail */}
      <div
        ref={containerRef}
        className="relative aspect-[16/10] bg-black overflow-hidden border-b border-white/10"
      >
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-white/90">
            {example.industryTag}
          </div>
          <div className="px-3 py-1 rounded-full bg-primary/80 backdrop-blur-md border border-white/10 text-xs font-semibold text-white/90">
            {example.patternTag}
          </div>
        </div>

        {/* Iframe wrapper for scaling */}
        <div
          className="absolute top-0 left-0 w-[1440px] h-[900px] origin-top-left [transform:scale(var(--scale))] transition-transform duration-700 ease-out group-hover:[transform:scale(var(--scale-hover))]"
          style={{ "--scale": scale, "--scale-hover": scale * 1.04 } as React.CSSProperties}
        >
          {/* Loading shimmer */}
          {!iframeLoaded && <div className="absolute inset-0 bg-slate-100 animate-pulse z-0" />}
          <iframe
            srcDoc={example.generatedCode}
            className={`w-full h-full border-0 pointer-events-none bg-transparent relative z-10 transition-opacity duration-300 ${iframeLoaded ? "opacity-100" : "opacity-0"}`}
            tabIndex={-1}
            sandbox="allow-scripts"
            onLoad={() => setIframeLoaded(true)}
          />
        </div>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
          <Link href={`/examples/${example.slug}`}>
            <Button variant="secondary" className="px-4 py-2 text-sm backdrop-blur-xl">
              View Live
            </Button>
          </Link>
          <Link href={`/dashboard/new?prompt=${encodeURIComponent(example.prompt)}`}>
            <Button variant="primary" className="px-4 py-2 text-sm shadow-lg">
              Use Prompt
            </Button>
          </Link>
        </div>
      </div>

      {/* Details */}
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-white mb-1">{example.title}</h3>
        <p className="text-sm font-medium text-white/80 mb-2">{example.description}</p>
        <p className="text-xs text-white/50 line-clamp-2 leading-relaxed italic mt-auto">
          &quot;{example.prompt}&quot;
        </p>
      </div>
    </div>
  );
}
