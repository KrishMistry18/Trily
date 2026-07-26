/**
 * lib/ai/code-generator.ts
 *
 * Code Generator — converts a SiteSpec into a single self-contained HTML5
 * file by calling the configured LLM provider.
 *
 * Requirements: 5.1, 5.2, 5.5
 */

import type { SiteSpec } from "./spec-generator";
import type { CodeFiles } from "./types";
import { aiProvider, logTokenUsage, withRetry } from "./index";

// ---------------------------------------------------------------------------
// Model / provider helpers (shared logic)
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
// System prompt builder
// ---------------------------------------------------------------------------

/**
 * buildCodeGenSystemPrompt
 *
 * Constructs the system prompt sent to the LLM for code generation.
 * The prompt explicitly includes:
 *   - Mobile-responsive instruction (320px and above) — Req 5.2
 *   - HTML5 validity requirement — Req 5.2
 *   - Exact color palette values from the SiteSpec
 */
export function buildCodeGenSystemPrompt(spec: SiteSpec): string {
  const { primary, secondary, accent, background, text } = spec.colorPalette;

  return `You are an expert front-end developer. Convert the provided site specification into a single, complete, self-contained HTML5 file.

REQUIREMENTS:
1. Output ONLY the HTML file — no markdown fences, no explanation, no text before or after.
2. The file must be valid HTML5 (use <!DOCTYPE html>, no deprecated tags, valid nesting).
3. All CSS must be inside a <style> tag in the <head>. All JavaScript must be inside a <script> tag at the end of <body>.
4. The layout must be MOBILE-RESPONSIVE using CSS media queries targeting viewport widths of 320px and above. Use a mobile-first approach.
5. Use EXACTLY these colors from the colour palette:
   - Primary:    ${primary}
   - Secondary:  ${secondary}
   - Accent:     ${accent}
   - Background: ${background}
   - Text:       ${text}
6. Implement ALL sections in the order provided, using the heading, copy, and layoutHint for each.
7. The page title must be: "${spec.pageTitle}"
8. Do NOT use external CDN resources for layout/styling — all CSS must be inline or in the <style> block.
9. Use semantic HTML5 elements (header, main, section, footer, nav, article, aside).`;
}

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

function buildCodeGenUserPrompt(spec: SiteSpec): string {
  const sectionsText = spec.sections
    .map(
      (s, i) =>
        `Section ${i + 1} (${s.type}):
  Heading: ${s.heading}
  Copy: ${s.copy}
  Layout: ${s.layoutHint}`
    )
    .join("\n\n");

  return `Generate the complete HTML5 website for: "${spec.pageTitle}"

Sections to implement:
${sectionsText}

Remember: output ONLY the HTML file, starting with <!DOCTYPE html>.`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * generateCode
 *
 * Calls the LLM to produce a self-contained HTML5 file from a SiteSpec.
 * Retries up to 3 times via withRetry on any failure.
 *
 * @param spec    Validated SiteSpec from the spec generator.
 * @param jobId   Generation job ID (for token logging).
 * @param userId  User ID (for token logging).
 * @returns       CodeFiles `{ html: string }`.
 */
export async function generateCode(
  spec: SiteSpec,
  jobId: string,
  userId: string
): Promise<CodeFiles> {
  const model = getModel();
  const provider = getProviderName();
  const systemPrompt = buildCodeGenSystemPrompt(spec);
  const userPrompt = buildCodeGenUserPrompt(spec);

  const result = await withRetry(async () => {
    const res = await aiProvider.complete({
      systemPrompt,
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
      callType: "code",
      generationJobId: jobId,
    });

    return res;
  });

  return { html: result.content.trim() };
}
