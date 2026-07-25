/**
 * lib/ai/index.ts
 *
 * Exports the active LLM provider selected by the AI_PROVIDER environment
 * variable ('anthropic' | 'openai').  Throws at import time if the variable
 * is not set to a recognised value, ensuring the application never starts in
 * a misconfigured state.
 *
 * Requirements: 14.1, 14.4
 */

import { anthropicProvider } from "./providers/anthropic";
import { openaiProvider } from "./providers/openai";
import type { LLMProvider } from "./types";

function resolveProvider(): LLMProvider {
  const aiProvider = process.env.AI_PROVIDER;

  if (aiProvider === "anthropic") {
    return anthropicProvider;
  }

  if (aiProvider === "openai") {
    return openaiProvider;
  }

  throw new Error(
    `AI_PROVIDER must be "anthropic" or "openai", got: ${JSON.stringify(aiProvider)}`
  );
}

export const aiProvider: LLMProvider = resolveProvider();

// Re-export shared types and utilities for convenience.
export type { LLMProvider, LLMCompleteParams, LLMCompleteResult, CodeFiles, LogTokenUsageParams } from "./types";
export { withRetry, TimeoutError, backoffDelay, sleep } from "./retry";
export { logTokenUsage } from "./token-logger";
