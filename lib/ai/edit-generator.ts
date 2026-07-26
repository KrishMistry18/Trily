/**
 * lib/ai/edit-generator.ts
 *
 * Edit Code Generator — applies a natural-language edit instruction to an
 * existing HTML file by calling the configured LLM provider.
 *
 * The full current HTML is always included in the user prompt so the LLM
 * has complete context of what it is modifying.
 *
 * Requirements: 8.3
 */

import type { CodeFiles } from "./types";
import { aiProvider, logTokenUsage, withRetry } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getModel(): string {
  return process.env.AI_PROVIDER === "openai"
    ? (process.env.OPENAI_MODEL ?? "gpt-4o")
    : (process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022");
}

function getProviderName(): string {
  return process.env.AI_PROVIDER === "openai" ? "openai" : "anthropic";
}

const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  "claude-3-5-sonnet-20241022": { input: 3e-6, output: 15e-6 },
  "gpt-4o": { input: 2.5e-6, output: 10e-6 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = COST_PER_TOKEN[model] ?? { input: 3e-6, output: 15e-6 };
  return promptTokens * pricing.input + completionTokens * pricing.output;
}

// ---------------------------------------------------------------------------
// Prompt builders (exported for testing)
// ---------------------------------------------------------------------------

const EDIT_SYSTEM_PROMPT = `You are an expert front-end developer performing targeted edits to an existing website.
You will be given the complete current HTML of a website and an edit instruction.

RULES:
1. Output ONLY the updated HTML file — no markdown fences, no explanation.
2. Preserve all existing structure, styles, and content UNLESS the edit instruction requires changing them.
3. Apply only the changes described in the edit instruction — do not make unrelated modifications.
4. Maintain HTML5 validity and mobile responsiveness (320px+).
5. Start your output with <!DOCTYPE html>.`;

/**
 * buildEditUserPrompt
 *
 * Constructs the user-facing prompt for an edit job.
 * The full currentHtml is always embedded so the LLM can see the entire code.
 */
export function buildEditUserPrompt(currentHtml: string, editPrompt: string): string {
  return `CURRENT HTML:
${currentHtml}

EDIT INSTRUCTION:
${editPrompt}

Apply the edit instruction to the HTML above and return the complete updated HTML file.`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * generateEditedCode
 *
 * Applies `editPrompt` to `currentHtml` via the active LLM provider.
 * Retries up to 3 times; logs token usage after every attempt.
 *
 * @param currentHtml  The full HTML of the current version.
 * @param editPrompt   The natural-language edit instruction.
 * @param jobId        Generation job ID (for token logging).
 * @param userId       User ID (for token logging).
 * @returns            Updated CodeFiles `{ html: string }`.
 */
export async function generateEditedCode(
  currentHtml: string,
  editPrompt: string,
  jobId: string,
  userId: string
): Promise<CodeFiles> {
  const model = getModel();
  const provider = getProviderName();
  const userPrompt = buildEditUserPrompt(currentHtml, editPrompt);

  const result = await withRetry(async () => {
    const res = await aiProvider.complete({
      systemPrompt: EDIT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 8192,
      model,
    });

    await logTokenUsage({
      userId,
      provider,
      modelName: model,
      promptTokens: res.promptTokens,
      completionTokens: res.completionTokens,
      estimatedCostUsd: estimateCost(model, res.promptTokens, res.completionTokens),
      callType: "edit",
      generationJobId: jobId,
    });

    return res;
  });

  return { html: result.content.trim() };
}
