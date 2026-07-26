"use client";

/**
 * components/ChatPanel.tsx
 *
 * Chat interface for iterative editing via natural-language prompts.
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 19.1
 */

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  prompt: string;
  status: "PENDING" | "APPLIED" | "FAILED";
  createdAt: string;
  isOptimistic?: boolean;
  errorMessage?: string;
}

interface ChatPanelProps {
  projectId: string;
  isJobInProgress?: boolean;
  onNewVersion?: (versionId: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-accent/20 text-accent" },
  APPLIED:  { label: "Applied", className: "bg-green-100 text-green-700" },
  FAILED:   { label: "Failed",  className: "bg-red-100 text-red-600"   },
};

const MIN_LEN = 5;
const MAX_LEN = 1000;

export default function ChatPanel({ projectId, isJobInProgress = false, onNewVersion }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);

  // Load messages on mount
  useEffect(() => {
    fetch(`/api/projects/${projectId}/chat`)
      .then((r) => r.json())
      .then((data: ChatMessage[]) => setMessages(data))
      .catch(() => {});
  }, [projectId]);

  // Scroll to bottom on new message
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const promptLen = prompt.length;
  const isValid = promptLen >= MIN_LEN && promptLen <= MAX_LEN;
  const canSubmit = isValid && !isSubmitting && !isJobInProgress;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      prompt,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setPrompt("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId
              ? { ...m, status: "FAILED", errorMessage: data.error ?? "Request failed" }
              : m
          )
        );
        return;
      }

      const { jobId } = (await res.json()) as { jobId: string; chatMessageId: string };

      // Subscribe to SSE for this job
      const es = new EventSource(`/api/jobs/${jobId}/status`);
      es.onmessage = (event: MessageEvent) => {
        const payload = JSON.parse(event.data as string) as { status: string; versionId?: string; error?: string };

        if (payload.status === "completed") {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? { ...m, status: "APPLIED" } : m))
          );
          if (payload.versionId && onNewVersion) onNewVersion(payload.versionId);
          es.close();
        } else if (payload.status === "failed") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId
                ? { ...m, status: "FAILED", errorMessage: payload.error ?? "Generation failed" }
                : m
            )
          );
          es.close();
        }
      };
      es.onerror = () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, status: "FAILED", errorMessage: "Connection lost" } : m
          )
        );
        es.close();
      };
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 px-3 py-3">
        {messages.length === 0 && (
          <p className="text-xs text-center text-foreground/40 mt-8">
            Send an edit instruction to refine your site
          </p>
        )}
        {messages.map((msg) => {
          const badge = STATUS_BADGE[msg.status] ?? STATUS_BADGE.PENDING;
          return (
            <div key={msg.id} className="rounded-lg bg-foreground/5 p-3 space-y-1.5">
              <p className="text-sm text-foreground">{msg.prompt}</p>
              <div className="flex items-center justify-between">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
                <span className="text-xs text-foreground/40">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {msg.status === "FAILED" && msg.errorMessage && (
                <p className="text-xs text-red-500">{msg.errorMessage}</p>
              )}
            </div>
          );
        })}
        <div ref={listEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-foreground/10 px-3 py-3 space-y-2">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isJobInProgress || isSubmitting}
            placeholder={isJobInProgress ? "Waiting for current generation…" : "Describe a change…"}
            rows={3}
            className="w-full resize-none rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground placeholder-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 transition"
            aria-label="Edit instruction"
          />
          <span className="absolute bottom-2 right-2 text-xs text-foreground/30 tabular-nums">
            {promptLen}/{MAX_LEN}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? "Sending…" : "Apply edit"}
        </button>
      </form>
    </div>
  );
}
