/**
 * lib/ai/providers/openai.ts
 *
 * OpenAI GPT provider implementing the LLMProvider interface.
 * Wraps the `openai` package for use inside the AI Service Layer.
 *
 * Requirements: 14.1, 14.4
 */

import OpenAI from "openai";
import type { LLMProvider, LLMCompleteParams, LLMCompleteResult } from "../types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.AI_API_KEY ?? "",
    });
  }
  return _client;
}

export const openaiProvider: LLMProvider = {
  async complete(params: LLMCompleteParams): Promise<LLMCompleteResult> {
    const client = getClient();

    const response = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });

    const choice = response.choices[0];
    const content = choice?.message?.content ?? "";

    return {
      content,
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
    };
  },
};
