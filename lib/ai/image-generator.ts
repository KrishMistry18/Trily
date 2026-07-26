/**
 * lib/ai/image-generator.ts
 *
 * Image Generator — produces a hero image for a site using Replicate or
 * fal.ai, selected by the IMAGE_PROVIDER environment variable.
 *
 * Requirements: 18.1, 18.3, 18.4, 18.5
 */

import { storageService } from "@/lib/storage";
import { logTokenUsage } from "./token-logger";
import { withRetry } from "./retry";
import type { SiteSpec } from "./spec-generator";

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class ImageGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

// ---------------------------------------------------------------------------
// Image cost (per-call flat rate, logged as a token-log record)
// ---------------------------------------------------------------------------

/** Approximate cost per image generation call in USD */
const IMAGE_COST_USD = 0.05;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * buildImagePrompt
 *
 * Derives an image generation prompt from the SiteSpec's hero section copy
 * and colour palette, per Requirements 18.1.
 */
export function buildImagePrompt(spec: SiteSpec): string {
  const hero = spec.sections.find((s) => s.type === "hero");
  const heroCopy = hero ? `${hero.heading}. ${hero.copy}` : spec.pageTitle;
  const { primary, accent } = spec.colorPalette;

  return (
    `A high-quality hero image for a website: ${heroCopy}. ` +
    `Color scheme: primary ${primary}, accent ${accent}. ` +
    `Professional, clean, modern design. Wide format, suitable for a website banner.`
  );
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function generateWithReplicate(prompt: string): Promise<Buffer> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw new ImageGenerationError("REPLICATE_API_TOKEN is not set");

  // Create a prediction
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4", // SDXL
      input: { prompt, width: 1280, height: 720, num_outputs: 1 },
    }),
  });

  if (!createRes.ok) {
    throw new ImageGenerationError(`Replicate prediction creation failed: ${createRes.status}`);
  }

  const prediction = await createRes.json() as { id: string; status: string; urls: { get: string }; output?: string[] };

  // Poll until complete (max 60 s)
  const pollUrl = prediction.urls.get;
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const polled = await pollRes.json() as { status: string; output?: string[]; error?: string };

    if (polled.status === "succeeded" && polled.output?.[0]) {
      const imgRes = await fetch(polled.output[0]);
      if (!imgRes.ok) throw new ImageGenerationError("Failed to download Replicate image");
      const arrayBuffer = await imgRes.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    if (polled.status === "failed") {
      throw new ImageGenerationError(`Replicate prediction failed: ${polled.error ?? "unknown"}`);
    }
  }

  throw new ImageGenerationError("Replicate prediction timed out");
}

async function generateWithFal(prompt: string): Promise<Buffer> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new ImageGenerationError("FAL_API_KEY is not set");

  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, image_size: "landscape_16_9", num_images: 1 }),
  });

  if (!res.ok) {
    throw new ImageGenerationError(`fal.ai request failed: ${res.status}`);
  }

  const data = await res.json() as { images?: Array<{ url: string }> };
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new ImageGenerationError("fal.ai returned no image URL");

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new ImageGenerationError("Failed to download fal.ai image");
  const arrayBuffer = await imgRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * generateHeroImage
 *
 * Generates a hero image for the given SiteSpec.  Retries up to 3 times.
 * On success: uploads to S3 and returns the storage key.
 * On failure after 3 retries: throws ImageGenerationError.
 *
 * @param spec    SiteSpec providing hero copy and colour palette.
 * @param userId  User ID (for storage path + token logging).
 * @param projectId  Project ID (for storage path).
 * @param jobId   Generation job ID (for token logging).
 * @returns       S3 storage key for the generated image.
 */
export async function generateHeroImage(
  spec: SiteSpec,
  userId: string,
  projectId: string,
  jobId: string
): Promise<string> {
  const imageProvider = process.env.IMAGE_PROVIDER ?? "replicate";
  const prompt = buildImagePrompt(spec);

  const buffer = await withRetry(async () => {
    return imageProvider === "fal"
      ? generateWithFal(prompt)
      : generateWithReplicate(prompt);
  });

  // Write the image to S3
  const filename = `hero-${Date.now()}.png`;
  const key = await storageService.writeImageFile(userId, projectId, filename, buffer);

  // Log cost record (no tokens for image generation — use flat cost)
  await logTokenUsage({
    userId,
    provider: imageProvider,
    modelName: imageProvider === "fal" ? "flux-schnell" : "sdxl",
    promptTokens: 0,
    completionTokens: 0,
    estimatedCostUsd: IMAGE_COST_USD,
    callType: "image",
    generationJobId: jobId,
  });

  return key;
}
