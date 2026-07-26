/**
 * lib/ai/token-logger.ts
 *
 * logTokenUsage — writes a TokenLog record to the database after every AI API
 * call, capturing provider, model, token counts, estimated cost, call type,
 * and the associated generation job.
 *
 * Requirements: 4.5, 5.5, 14.5, 18.5
 */
import { db } from "@/lib/db";

import type { LogTokenUsageParams } from "./types";

/**
 * logTokenUsage
 *
 * Inserts a TokenLog row in the database. All fields are required except
 * `generationJobId`, which is optional for standalone calls.
 *
 * @param params  Token-log fields.
 * @returns       The created TokenLog record.
 */
export async function logTokenUsage(params: LogTokenUsageParams) {
  const {
    userId,
    provider,
    modelName,
    promptTokens,
    completionTokens,
    estimatedCostUsd,
    callType,
    generationJobId,
  } = params;

  const tokenLogRef = db.collection("tokenLogs").doc();
  await tokenLogRef.set({
    userId,
    provider,
    modelName,
    promptTokens,
    completionTokens,
    estimatedCostUsd,
    callType,
    generationJobId: generationJobId ?? null,
  });
  return { id: tokenLogRef.id };
}
