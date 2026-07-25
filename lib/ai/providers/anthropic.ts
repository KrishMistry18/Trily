/**
 * lib/ai/providers/anthropic.ts
 *
 * Anthropic Claude provider implementing the LLMProvider interface.
 * Wraps @anthropic-ai/sdk for use inside the AI Service Layer.
 *
 * Requirements: 14.1, 14.4
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMCompleteParams, LLMCompleteResult } from "../types";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.AI_API_KEY ?? "",
    });
  }
  return _client;
}

export const anthropicProvider: LLMProvider = {
  async complete(params: LLMCompleteParams): Promise<LLMCompleteResult> {
    const client = getClient();

    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: [
        {
          role: "user",
          content: params.userPrompt,
        },
      ],
    });

    const content =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return {
      content,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
    };
  },
};
