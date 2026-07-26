/**
 * lib/ai/spec-generator.ts
 *
 * Spec Generator — converts a natural-language prompt into a structured
 * SiteSpec JSON object by calling the configured LLM provider.
 *
 * Retry strategy: up to 3 attempts via withRetry.  If the LLM returns JSON
 * that fails schema validation, a corrective instruction is prepended to the
 * next call before retrying.
 *
 * Requirements: 4.1, 4.2, 4.5
 */

import { z } from "zod";

import { aiProvider, logTokenUsage, withRetry } from "./index";

// ---------------------------------------------------------------------------
// SiteSpec schema (Zod)
// ---------------------------------------------------------------------------

export const SiteSpecSchema = z.object({
  pageTitle: z.string().min(1),
  colorPalette: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex colour"),
    secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  sections: z
    .array(
      z.object({
        type: z.enum([
          "hero",
          "features",
          "about",
          "contact",
          "footer",
          "gallery",
          "pricing",
          "testimonials",
        ]),
        heading: z.string(),
        copy: z.string(),
        layoutHint: z.string(),
      })
    )
    .min(1),
});

export type SiteSpec = z.infer<typeof SiteSpecSchema>;

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

const BASE_SYSTEM_PROMPT = `You are a website specification generator.
Your task is to convert a natural-language description into a structured JSON site specification.

RULES:
- Output ONLY valid JSON — no markdown fences, no extra text before or after.
- The JSON must conform exactly to this schema:
{
  "pageTitle": "string",
  "colorPalette": {
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "background": "#RRGGBB",
    "text": "#RRGGBB"
  },
  "sections": [
    {
      "type": "hero" | "features" | "about" | "contact" | "footer" | "gallery" | "pricing" | "testimonials",
      "heading": "string",
      "copy": "string",
      "layoutHint": "string"
    }
  ]
}
- colorPalette values must be 6-digit hex colours starting with #.
- sections must contain at least one item.
- Choose section types appropriate for the described website.`;

function buildSystemPrompt(correctionNote?: string): string {
  if (!correctionNote) return BASE_SYSTEM_PROMPT;
  return `${BASE_SYSTEM_PROMPT}\n\n${correctionNote}`;
}

// ---------------------------------------------------------------------------
// Model selection helpers
// ---------------------------------------------------------------------------

function getModel(): string {
  const provider = process.env.AI_PROVIDER;
  if (provider === "openai") {
    return process.env.OPENAI_MODEL ?? "gpt-4o";
  }
  return process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022";
}

function getProviderName(): string {
  return process.env.AI_PROVIDER === "openai" ? "openai" : "anthropic";
}

// ---------------------------------------------------------------------------
// Cost estimation (static map, updated when provider pricing changes)
// ---------------------------------------------------------------------------

const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "claude-3-5-sonnet-20241022": { input: 3e-6, output: 15e-6 },
  "gpt-4o": { input: 2.5e-6, output: 10e-6 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = COST_PER_TOKEN[model] ?? { input: 3e-6, output: 15e-6 };
  return promptTokens * pricing.input + completionTokens * pricing.output;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * generateSpec
 *
 * Calls the LLM to produce a SiteSpec from `prompt`.  Retries up to 3 times;
 * on schema validation failure the corrective instruction is prepended.
 *
 * @param prompt  Natural-language site description.
 * @param jobId   Generation job ID (for token logging).
 * @param userId  User ID (for token logging).
 * @returns       Parsed SiteSpec.
 */
export async function generateSpec(
  prompt: string,
  jobId: string,
  userId: string
): Promise<SiteSpec> {
  const model = getModel();
  const provider = getProviderName();

  let correctionNote: string | undefined;
  let lastError: unknown;

  // withRetry handles the 60 s timeout per attempt; we manage the corrective
  // prompt ourselves across up to 3 attempts.
  for (let attempt = 0; attempt < 3; attempt++) {
    const systemPrompt = buildSystemPrompt(correctionNote);

    try {
      const result = await withRetry(
        () =>
          aiProvider.complete({
            systemPrompt,
            userPrompt: prompt,
            maxTokens: 2048,
            model,
          }),
        1 // single attempt per outer loop iteration — outer loop manages retries
      );

      // Log token usage regardless of parse success.
      await logTokenUsage({
        userId,
        provider,
        modelName: model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        estimatedCostUsd: estimateCost(model, result.promptTokens, result.completionTokens),
        callType: "spec",
        generationJobId: jobId,
      });

      // Attempt to parse the LLM response as JSON, then validate with Zod.
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.content.trim());
      } catch (jsonErr) {
        const msg = jsonErr instanceof Error ? jsonErr.message : String(jsonErr);
        correctionNote = `Your previous response was not valid JSON. Return only the JSON object. Previous error: ${msg}`;
        lastError = jsonErr;
        continue;
      }

      const validated = SiteSpecSchema.safeParse(parsed);
      if (!validated.success) {
        const zodError = validated.error.message;
        correctionNote = `Your previous response was not valid JSON. Return only the JSON object. Previous error: ${zodError}`;
        lastError = new Error(zodError);
        continue;
      }

      return validated.data;
    } catch (err) {
      lastError = err;
      // LLM call itself failed — let the outer loop retry.
      if (attempt < 2) {
        correctionNote = undefined; // don't add correction for network failures
        continue;
      }
    }
  }

  throw lastError ?? new Error("Spec generation failed after 3 attempts");
}
