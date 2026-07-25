/**
 * lib/storage/s3Client.ts
 *
 * Singleton S3Client configured from environment variables.
 * Supports Cloudflare R2 (or any S3-compatible endpoint) via S3_ENDPOINT.
 *
 * All credentials are loaded exclusively server-side — never exposed to
 * the client bundle.  Import this file only from server-side code.
 */

import { S3Client } from "@aws-sdk/client-s3";

/**
 * Returns the S3Client.  In production the client is constructed from the
 * real environment; in tests a pre-configured mock/substitute client can be
 * injected by overwriting this export before the storage service is called.
 */
function createS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    // For Cloudflare R2 or other S3-compatible endpoints, set S3_ENDPOINT.
    // When the variable is absent the AWS SDK uses the default endpoint.
    endpoint: process.env.S3_ENDPOINT ?? undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export const s3 = createS3Client();
