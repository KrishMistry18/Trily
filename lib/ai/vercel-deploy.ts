/**
 * lib/ai/vercel-deploy.ts
 *
 * Vercel deployment helper.
 *
 * Posts a deployment to the Vercel API v13 deployments endpoint.
 * The VERCEL_API_TOKEN is stored server-side only and never exposed to
 * the client (Next.js server component / route handler context only).
 *
 * Requirements: 11.1, 11.5
 */

import type { CodeFiles } from "@/lib/storage";

export interface VercelDeploymentFile {
  file: string;   // relative path within the deployment
  data: string;   // file content (UTF-8 string)
}

export interface DeployToVercelParams {
  projectName: string;  // used as the Vercel project name
  files: CodeFiles;
  versionId: string;    // used for unique deployment naming
}

export interface DeployToVercelResult {
  deployUrl: string;
}

/**
 * Deploys the provided files to Vercel using the Deployments v13 API.
 *
 * Throws an error (which the caller should catch and convert to 502) if the
 * Vercel API call fails.
 *
 * @param projectName  Human-readable project name (e.g., "orbis-proj_xxx")
 * @param files        CodeFiles containing index.html
 * @param versionId    Version ID — appended to deployment name for uniqueness
 */
export async function deployToVercel(
  projectName: string,
  files: CodeFiles,
  versionId: string
): Promise<DeployToVercelResult> {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    throw new Error("VERCEL_API_TOKEN is not configured");
  }

  const deploymentName = `${projectName}-${versionId}`.toLowerCase().slice(0, 52);

  const payload = {
    name: deploymentName,
    files: [
      {
        file: "index.html",
        data: files.html,
      },
    ],
    projectSettings: {
      framework: null,  // static deployment
    },
    target: "production",
  };

  const response = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(
      `Vercel API returned ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as { url?: string; alias?: string[] };

  const deployUrl =
    data.alias?.[0]
      ? `https://${data.alias[0]}`
      : `https://${data.url}`;

  if (!deployUrl || deployUrl === "https://undefined") {
    throw new Error("Vercel API did not return a deployment URL");
  }

  return { deployUrl };
}
