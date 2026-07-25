/**
 * lib/ai/types.ts
 *
 * Shared TypeScript types for the AI Service Layer.
 */

// ---------------------------------------------------------------------------
// LLM Provider interface
// ---------------------------------------------------------------------------

export interface LLMCompleteParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  model: string;
}

export interface LLMCompleteResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

export interface LLMProvider {
  complete(params: LLMCompleteParams): Promise<LLMCompleteResult>;
}

// ---------------------------------------------------------------------------
// Code files
// ---------------------------------------------------------------------------

export interface CodeFiles {
  html: string;
}

// ---------------------------------------------------------------------------
// Token log params
// ---------------------------------------------------------------------------

export interface LogTokenUsageParams {
  userId: string;
  provider: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  callType: string; // 'spec' | 'code' | 'edit' | 'image'
  generationJobId?: string;
}
