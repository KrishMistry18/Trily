"use server";

import { auth } from "@/auth";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { trackEvent } from "@/lib/analytics";
import { EDIT_COST, FULL_GENERATION_COST } from "@/lib/billing/config";
import { checkAndDeductCredits, refundCredits } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are an expert web developer.
Output a complete, self-contained single-file HTML/CSS/JS website based on the user's description.
The output MUST contain exactly one markdown fenced code block starting with \`\`\`html and ending with \`\`\`.
Do not include any explanations, greetings, or other text outside of the code block.
Use modern, beautiful design principles, inline <style>, and inline <script>. Always include a complete <html> document.`;

const EDIT_SYSTEM_PROMPT = `You are an expert web developer.
The user wants to edit an existing HTML file.
I will provide the current HTML code and the user's edit instruction.
Return the FULL updated HTML file in a single markdown code block starting with \`\`\`html and ending with \`\`\`.
Do NOT return partial diffs. Do NOT include explanations outside the code block.
Ensure the original structure and unaffected logic is preserved unless modified by the instruction.`;

async function getAuthenticatedUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

export async function generateWebsiteAction(prompt: string) {
  try {
    const userId = await getAuthenticatedUserId();

    // 0. Check rate limit
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: "rate_limit_exceeded",
        message: "Too many requests. Please wait a minute.",
      };
    }

    // 1. Check and deduct credits (throws if insufficient)
    try {
      await checkAndDeductCredits(userId, "generation");
    } catch (error: any) {
      if (error.message.includes("Insufficient credits")) {
        return { success: false, error: "out_of_credits" };
      }
      throw error;
    }

    trackEvent("generation_started", { userId });

    // 2. Retry wrapper for Gemini API
    let attempts = 0;
    const maxRetries = 2;
    let generatedHtml = "";

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.5,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
      ],
    });

    while (attempts <= maxRetries) {
      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parse the code block
        const match = text.match(/```(?:html)?\s*([\s\S]*?)```/);
        if (match && match[1]) {
          generatedHtml = match[1].trim();
          break; // Success
        } else {
          // If the model didn't use code blocks, sometimes it just outputs pure HTML
          if (text.trim().startsWith("<!DOCTYPE html>") || text.trim().startsWith("<html")) {
            generatedHtml = text.trim();
            break;
          }
          throw new Error("Failed to parse HTML code block from response");
        }
      } catch (error: any) {
        if (error?.message?.includes("SAFETY")) {
          await refundCredits(userId, FULL_GENERATION_COST, "generation");
          return {
            success: false,
            error: "content_moderation_flagged",
            message:
              "Your prompt was flagged by our safety filters. Please revise your description.",
          };
        }
        attempts++;
        if (attempts > maxRetries) {
          console.error("Gemini Generation failed after max retries:", error);
          await refundCredits(userId, FULL_GENERATION_COST, "generation");
          return {
            success: false,
            error: "high_demand",
            message: "High demand, please try again in a moment.",
          };
        }
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
      }
    }

    // 3. Save to Firestore
    const projectId = randomUUID();
    const versionId = randomUUID();

    const batch = db.batch();

    // Create Project
    const projectRef = db.collection("projects").doc(projectId);
    batch.set(projectRef, {
      projectId,
      ownerId: userId,
      name: "Generated Project",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      status: "draft",
      currentVersionId: versionId,
      thumbnailUrl: "",
    });

    // Create ProjectVersion
    const versionRef = db
      .collection("projects")
      .doc(projectId)
      .collection("versions")
      .doc(versionId);
    batch.set(versionRef, {
      versionId,
      projectId,
      prompt,
      generatedCode: generatedHtml,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId,
      parentVersionId: null,
    });

    await batch.commit();

    trackEvent("generation_completed", { userId, projectId });

    return { success: true, projectId };
  } catch (error: any) {
    console.error("Website generation error:", error);
    return { success: false, error: "server_error", message: error.message };
  }
}

export async function editWebsiteAction(
  projectId: string,
  currentVersionId: string,
  prompt: string,
) {
  try {
    const userId = await getAuthenticatedUserId();

    // 0. Check rate limit
    const rateLimit = await checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: "rate_limit_exceeded",
        message: "Too many requests. Please wait a minute.",
      };
    }

    // 1. Check and deduct credits
    try {
      await checkAndDeductCredits(userId, "edit", projectId);
    } catch (error: any) {
      if (error.message.includes("Insufficient credits")) {
        return { success: false, error: "out_of_credits" };
      }
      throw error;
    }

    // 2. Fetch current code
    const versionDoc = await db
      .collection("projects")
      .doc(projectId)
      .collection("versions")
      .doc(currentVersionId)
      .get();
    if (!versionDoc.exists) {
      return { success: false, error: "version_not_found" };
    }
    const currentCode = versionDoc.data()?.generatedCode || "";

    // 3. Retry wrapper for Gemini API
    let attempts = 0;
    const maxRetries = 2;
    let generatedHtml = "";

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: EDIT_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.4,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
      ],
    });

    const fullPrompt = `Current Code:\n\`\`\`html\n${currentCode}\n\`\`\`\n\nEdit Instruction:\n${prompt}`;

    while (attempts <= maxRetries) {
      try {
        const result = await model.generateContent(fullPrompt);
        const text = result.response.text();

        const match = text.match(/```(?:html)?\s*([\s\S]*?)```/);
        if (match && match[1]) {
          generatedHtml = match[1].trim();
          break;
        } else {
          if (text.trim().startsWith("<!DOCTYPE html>") || text.trim().startsWith("<html")) {
            generatedHtml = text.trim();
            break;
          }
          throw new Error("Failed to parse HTML code block from response");
        }
      } catch (error: any) {
        if (error?.message?.includes("SAFETY")) {
          await refundCredits(userId, EDIT_COST, "edit", projectId);
          return {
            success: false,
            error: "content_moderation_flagged",
            message: "Your edit was flagged by our safety filters. Please revise your description.",
          };
        }
        attempts++;
        if (attempts > maxRetries) {
          console.error("Gemini Edit failed after max retries:", error);
          await refundCredits(userId, EDIT_COST, "edit", projectId);
          return {
            success: false,
            error: "high_demand",
            message: "High demand, please try again in a moment.",
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
      }
    }

    // 4. Save to Firestore
    const newVersionId = randomUUID();
    const batch = db.batch();

    // Create new ProjectVersion
    const versionRef = db
      .collection("projects")
      .doc(projectId)
      .collection("versions")
      .doc(newVersionId);
    batch.set(versionRef, {
      versionId: newVersionId,
      projectId,
      prompt,
      generatedCode: generatedHtml,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: userId,
      parentVersionId: currentVersionId,
    });

    // Update Project's currentVersionId
    const projectRef = db.collection("projects").doc(projectId);
    batch.update(projectRef, {
      currentVersionId: newVersionId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    trackEvent("edit_completed", { userId, projectId, versionId: newVersionId });

    return { success: true, versionId: newVersionId };
  } catch (error: any) {
    console.error("Website edit error:", error);
    return { success: false, error: "server_error", message: error.message };
  }
}
