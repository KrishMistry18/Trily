"use client";

import { useState } from "react";

import { editWebsiteAction } from "@/app/actions/generation";

interface EditChatInputProps {
  projectId: string;
  activeVersionId: string;
  onEditComplete: (newVersionId: string) => void;
  disabled?: boolean;
}

export default function EditChatInput({
  projectId,
  activeVersionId,
  onEditComplete,
  disabled = false,
}: EditChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const MIN_LEN = 5;
  const MAX_LEN = 1000;
  const promptLen = prompt.length;
  const canSubmit = promptLen >= MIN_LEN && promptLen <= MAX_LEN && !isSubmitting && !disabled;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await editWebsiteAction(projectId, activeVersionId, prompt);
      if (res.success && res.versionId) {
        setPrompt("");
        onEditComplete(res.versionId);
      } else {
        setErrorMsg(res.message || res.error || "Failed to edit website");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-card border rounded-xl p-3 flex flex-col shadow-sm">
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="relative flex-1">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isSubmitting || disabled}
            placeholder="Type follow-up instructions to refine your site (e.g., 'make the header sticky' or 'change to dark mode')..."
            rows={2}
            className="w-full resize-none rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground placeholder-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 transition"
          />
          <span className="absolute bottom-2 right-2 text-xs text-foreground/30 tabular-nums">
            {promptLen}/{MAX_LEN}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition h-[58px] flex items-center justify-center min-w-[100px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              Editing...
            </span>
          ) : (
            "Apply Edit"
          )}
        </button>
      </form>
      {errorMsg && <p className="text-xs text-red-500 mt-2 ml-1">{errorMsg}</p>}
    </div>
  );
}
