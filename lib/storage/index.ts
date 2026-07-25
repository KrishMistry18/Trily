/**
 * lib/storage/index.ts
 *
 * StorageService — thin wrapper around the S3 client that implements all
 * object-storage operations required by Orbis.
 *
 * Path conventions (mirrors design.md §Storage Layout):
 *   Version code : {userId}/{projectId}/{versionId}/index.html
 *   ZIP archive  : {userId}/{projectId}/{versionId}/export.zip
 *   Hero image   : {userId}/{projectId}/images/{filename}
 *
 * All credentials and URL-signing happen server-side only.
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */

import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "./s3Client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeFiles {
  html: string;
}

export interface StorageService {
  writeVersionFiles(
    userId: string,
    projectId: string,
    versionId: string,
    files: CodeFiles
  ): Promise<void>;

  readVersionFiles(
    userId: string,
    projectId: string,
    versionId: string
  ): Promise<CodeFiles>;

  writeZipArchive(
    userId: string,
    projectId: string,
    versionId: string,
    zip: Buffer
  ): Promise<string>;

  getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  writeImageFile(
    userId: string,
    projectId: string,
    filename: string,
    buffer: Buffer
  ): Promise<string>;
}

// ---------------------------------------------------------------------------
// Path helpers (exported so property tests can verify key construction)
// ---------------------------------------------------------------------------

export function versionHtmlKey(
  userId: string,
  projectId: string,
  versionId: string
): string {
  return `${userId}/${projectId}/${versionId}/index.html`;
}

export function versionZipKey(
  userId: string,
  projectId: string,
  versionId: string
): string {
  return `${userId}/${projectId}/${versionId}/export.zip`;
}

export function imageKey(
  userId: string,
  projectId: string,
  filename: string
): string {
  return `${userId}/${projectId}/images/${filename}`;
}

// ---------------------------------------------------------------------------
// Minimum expiry enforced by the storage service
// ---------------------------------------------------------------------------

/** Minimum presigned URL expiry in seconds (1 hour). Requirement 17.3 */
export const MIN_PRESIGNED_EXPIRY_SECONDS = 3600;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const bucket = process.env.S3_BUCKET_NAME ?? "";

/**
 * writeVersionFiles
 *
 * Writes the generated HTML for a Version to
 * `{userId}/{projectId}/{versionId}/index.html`.
 *
 * Requirement 17.1, 17.2
 */
async function writeVersionFiles(
  userId: string,
  projectId: string,
  versionId: string,
  files: CodeFiles
): Promise<void> {
  const key = versionHtmlKey(userId, projectId, versionId);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: files.html,
      ContentType: "text/html; charset=utf-8",
    })
  );
}

/**
 * readVersionFiles
 *
 * Retrieves `{userId}/{projectId}/{versionId}/index.html` and returns the
 * HTML content as a string.
 */
async function readVersionFiles(
  userId: string,
  projectId: string,
  versionId: string
): Promise<CodeFiles> {
  const key = versionHtmlKey(userId, projectId, versionId);
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const body = response.Body;
  if (!body) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  // Consume the stream
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  const html = Buffer.concat(chunks).toString("utf-8");
  return { html };
}

/**
 * writeZipArchive
 *
 * Uploads a ZIP buffer to `{userId}/{projectId}/{versionId}/export.zip`
 * and returns the storage key.
 *
 * Requirement 17.1
 */
async function writeZipArchive(
  userId: string,
  projectId: string,
  versionId: string,
  zip: Buffer
): Promise<string> {
  const key = versionZipKey(userId, projectId, versionId);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: zip,
      ContentType: "application/zip",
    })
  );
  return key;
}

/**
 * getPresignedUrl
 *
 * Generates a pre-signed GET URL for any key in the bucket.
 * Enforces a minimum expiry of 3600 seconds (1 hour).
 *
 * Requirement 17.3, 17.4
 */
async function getPresignedUrl(
  key: string,
  expiresInSeconds: number = MIN_PRESIGNED_EXPIRY_SECONDS
): Promise<string> {
  // Clamp to minimum to satisfy Requirement 17.3
  const effectiveExpiry = Math.max(expiresInSeconds, MIN_PRESIGNED_EXPIRY_SECONDS);

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: effectiveExpiry });
}

/**
 * writeImageFile
 *
 * Uploads a hero image buffer to `{userId}/{projectId}/images/{filename}`
 * and returns the storage key.
 *
 * Requirement 17.1
 */
async function writeImageFile(
  userId: string,
  projectId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const key = imageKey(userId, projectId, filename);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: "image/png",
    })
  );
  return key;
}

// ---------------------------------------------------------------------------
// Export singleton
// ---------------------------------------------------------------------------

export const storageService: StorageService = {
  writeVersionFiles,
  readVersionFiles,
  writeZipArchive,
  getPresignedUrl,
  writeImageFile,
};
