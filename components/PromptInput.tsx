"use client";

/**
 * components/PromptInput.tsx
 *
 * Prompt input form for creating a new project.
 *
 * Features:
 * - Textarea: 10–2000 char limit with live counter
 * - Optional preset picker
 * - Credit balance display (fetched from GET /api/billing/balance)
 * - Submit disabled when credit balance = 0 or prompt is invalid
 * - On submit: POST /api/projects, navigate to /dashboard/projects/{id}?jobId={id}
 * - Mobile-responsive at 320px+
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 19.1
 */
import { useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------
const PRESETS = [
  {
    label: "SaaS Landing Page",
    template:
      "Create a modern SaaS landing page for a productivity tool. Include a hero section with a compelling headline, features section highlighting 3 key benefits, pricing section with 3 tiers (Free, Pro, Business), and a footer with links.",
  },
  {
    label: "Restaurant Website",
    template:
      "Create a restaurant website for an Italian bistro called 'La Cucina'. Include a hero with a beautiful food photo, menu highlights section, about us section with the story, location and hours, and online reservation CTA.",
  },
  {
    label: "Portfolio",
    template:
      "Create a personal portfolio website for a web developer. Include a hero with name and tagline, skills section, featured projects grid with 4 projects, testimonials, and contact form.",
  },
  {
    label: "E-commerce Store",
    template:
      "Create an e-commerce landing page for a sustainable clothing brand called 'EcoWear'. Include a hero section, featured products grid, sustainability values section, customer reviews, and newsletter signup.",
  },
  {
    label: "Blog",
    template:
      "Create a personal blog website for a travel photographer. Include a hero with a stunning image, recent posts grid, about me section, categories sidebar, and social links.",
  },
];

const PROMPT_MIN = 10;
const PROMPT_MAX = 2000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PromptInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") || "";

  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedPreset, setSelectedPreset] = useState("");

  useEffect(() => {
    if (initialPrompt && initialPrompt !== prompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);
  const [balance, setBalance] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch credit balance on mount
  useEffect(() => {
    fetch("/api/billing/balance")
      .then((r) => r.json())
      .then((data: { balance?: number }) => {
        setBalance(typeof data.balance === "number" ? data.balance : 0);
      })
      .catch(() => setBalance(0));
  }, []);

  // Apply preset
  function handlePresetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const label = e.target.value;
    setSelectedPreset(label);
    const preset = PRESETS.find((p) => p.label === label);
    if (preset) {
      setPrompt(preset.template);
    }
  }

  // Validation
  const promptLength = prompt.length;
  const isPromptValid = promptLength >= PROMPT_MIN && promptLength <= PROMPT_MAX;
  const hasCredits = balance !== null && balance > 0;
  const canSubmit = isPromptValid && hasCredits && !isSubmitting;

  // Submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        if (response.status === 402) {
          setError(
            "You don't have enough credits. Please upgrade your plan or purchase more credits.",
          );
        } else {
          setError(data.error ?? "Failed to create project. Please try again.");
        }
        return;
      }

      const data = (await response.json()) as {
        projectId: string;
        jobId: string;
      };
      router.push(`/projects/${data.projectId}?jobId=${data.jobId}`);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const charCountColor =
    promptLength > PROMPT_MAX
      ? "text-red-500"
      : promptLength > PROMPT_MAX * 0.9
        ? "text-accent"
        : "text-foreground/40";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Preset picker */}
      <div className="space-y-1.5">
        <label htmlFor="preset" className="block text-sm font-medium text-foreground">
          Start from a template <span className="text-foreground/40">(optional)</span>
        </label>
        <select
          id="preset"
          value={selectedPreset}
          onChange={handlePresetChange}
          className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
        >
          <option value="">— Choose a preset —</option>
          {PRESETS.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Prompt textarea */}
      <div className="space-y-1.5">
        <label htmlFor="prompt" className="block text-sm font-medium text-foreground">
          Describe your website
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          minLength={PROMPT_MIN}
          maxLength={PROMPT_MAX + 100} // allow typing to see the error
          rows={6}
          placeholder="Describe the website you want to create. Be specific about the type, purpose, style, and any key sections you want included..."
          className="w-full resize-none rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground placeholder-foreground/40 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
          aria-describedby="prompt-counter prompt-validation"
        />
        {/* Character counter */}
        <div className="flex items-center justify-between">
          <span id="prompt-validation" className="text-xs text-red-500">
            {promptLength > 0 && promptLength < PROMPT_MIN
              ? `Minimum ${PROMPT_MIN} characters required`
              : promptLength > PROMPT_MAX
                ? `Maximum ${PROMPT_MAX} characters exceeded`
                : ""}
          </span>
          <span
            id="prompt-counter"
            className={`text-xs tabular-nums ${charCountColor}`}
            aria-live="polite"
          >
            {promptLength} / {PROMPT_MAX}
          </span>
        </div>
      </div>

      {/* Credit balance display */}
      <div className="flex items-center justify-between rounded-lg bg-foreground/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Credit balance</p>
          {balance === null ? (
            <p className="text-xs text-foreground/40">Loading…</p>
          ) : balance === 0 ? (
            <p className="text-xs text-red-500">
              No credits remaining.{" "}
              <a href="/account" className="underline hover:text-red-600">
                Purchase more
              </a>
            </p>
          ) : (
            <p className="text-xs text-foreground/60">
              {balance} credits available
              <span className="ml-1 text-foreground/40">· 5 credits per generation</span>
            </p>
          )}
        </div>
        <span className="text-2xl" aria-hidden="true">
          ⚡
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm"
        >
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
        aria-disabled={!canSubmit}
      >
        {isSubmitting ? (
          <>
            <svg
              className="animate-spin h-4 w-4 text-white"
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
            Generating…
          </>
        ) : balance === 0 ? (
          "Purchase credits to generate"
        ) : (
          "Generate my site"
        )}
      </button>
    </form>
  );
}
