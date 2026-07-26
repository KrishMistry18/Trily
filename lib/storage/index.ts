/**
 * lib/storage/index.ts
 *
 * StorageService — thin wrapper around Firebase Storage that implements all
 * object-storage operations required by Trily.
 *
 * Path conventions (mirrors design.md §Storage Layout):
 *   Version code : {userId}/{projectId}/{versionId}/index.html
 *   ZIP archive  : {userId}/{projectId}/{versionId}/export.zip
 *   Hero image   : {userId}/{projectId}/images/{filename}
 *
 * All credentials and URL-signing happen server-side only.
 * Requirements: 17.1, 17.2, 17.3, 17.4
 */
// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------
import { getStorage } from "firebase-admin/storage";

import { firebaseAdminApp } from "../db";

// Types

export interface CodeFiles {
  html: string;
}

export interface StorageService {
  writeVersionFiles(
    userId: string,
    projectId: string,
    versionId: string,
    files: CodeFiles,
  ): Promise<void>;

  readVersionFiles(userId: string, projectId: string, versionId: string): Promise<CodeFiles>;

  writeZipArchive(
    userId: string,
    projectId: string,
    versionId: string,
    zip: Buffer,
  ): Promise<string>;

  getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;

  writeImageFile(
    userId: string,
    projectId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<string>;
}

// ---------------------------------------------------------------------------
// Path helpers (exported so property tests can verify key construction)
// ---------------------------------------------------------------------------

export function versionHtmlKey(userId: string, projectId: string, versionId: string): string {
  return `${userId}/${projectId}/${versionId}/index.html`;
}

export function versionZipKey(userId: string, projectId: string, versionId: string): string {
  return `${userId}/${projectId}/${versionId}/export.zip`;
}

export function imageKey(userId: string, projectId: string, filename: string): string {
  return `${userId}/${projectId}/images/${filename}`;
}

// ---------------------------------------------------------------------------
// Minimum expiry enforced by the storage service
// ---------------------------------------------------------------------------

/** Minimum presigned URL expiry in seconds (1 hour). Requirement 17.3 */
export const MIN_PRESIGNED_EXPIRY_SECONDS = 3600;

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";

function getBucket() {
  return getStorage(firebaseAdminApp).bucket(bucketName);
}

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
  files: CodeFiles,
): Promise<void> {
  const key = versionHtmlKey(userId, projectId, versionId);
  const file = getBucket().file(key);

  await file.save(files.html, {
    metadata: {
      contentType: "text/html; charset=utf-8",
    },
  });
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
  versionId: string,
): Promise<CodeFiles> {
  const key = versionHtmlKey(userId, projectId, versionId);
  const file = getBucket().file(key);

  const [content] = await file.download();

  if (!content) {
    throw new Error(`Empty response body for key: ${key}`);
  }

  const html = content.toString("utf-8");
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
  zip: Buffer,
): Promise<string> {
  const key = versionZipKey(userId, projectId, versionId);
  const file = getBucket().file(key);

  await file.save(zip, {
    metadata: {
      contentType: "application/zip",
    },
  });

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
  expiresInSeconds: number = MIN_PRESIGNED_EXPIRY_SECONDS,
): Promise<string> {
  // Clamp to minimum to satisfy Requirement 17.3
  const effectiveExpiry = Math.max(expiresInSeconds, MIN_PRESIGNED_EXPIRY_SECONDS);

  const file = getBucket().file(key);

  // Note: Firebase uses Date objects for expiry
  const expires = new Date(Date.now() + effectiveExpiry * 1000);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires,
  });

  return url;
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
  buffer: Buffer,
): Promise<string> {
  const key = imageKey(userId, projectId, filename);
  const file = getBucket().file(key);

  await file.save(buffer, {
    metadata: {
      contentType: "image/png",
    },
  });

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
