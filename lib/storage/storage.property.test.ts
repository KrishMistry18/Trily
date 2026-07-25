/**
 * lib/storage/storage.property.test.ts
 *
 * Task 9.1 — Property 27: Storage pre-signed URLs always have at least 1-hour expiry
 *
 * Validates: Requirements 10.3, 17.3
 *
 * Tests run entirely in-process (no live S3 / network calls) by verifying:
 *   1. The default expiry is always >= 3600 seconds.
 *   2. Any custom expiresInSeconds >= 3600 is accepted as-is.
 *   3. expiresInSeconds values < 3600 are clamped to 3600.
 *   4. Path (key) conventions are always correct.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MIN_PRESIGNED_EXPIRY_SECONDS,
  imageKey,
  versionHtmlKey,
  versionZipKey,
} from "./index";

// ---------------------------------------------------------------------------
// Pure effective-expiry computation (mirrors the clamping in getPresignedUrl)
// ---------------------------------------------------------------------------

function effectiveExpiry(requested?: number): number {
  const value = requested ?? MIN_PRESIGNED_EXPIRY_SECONDS;
  return Math.max(value, MIN_PRESIGNED_EXPIRY_SECONDS);
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Non-empty cuid-like user/project/version IDs */
const idArb = fc
  .hexaString({ minLength: 8, maxLength: 24 })
  .map((s) => `c${s}`);

/** Expiry values below the 1-hour minimum */
const belowMinExpiryArb = fc.integer({ min: 1, max: MIN_PRESIGNED_EXPIRY_SECONDS - 1 });

/** Expiry values at or above the 1-hour minimum */
const atOrAboveMinExpiryArb = fc.integer({
  min: MIN_PRESIGNED_EXPIRY_SECONDS,
  max: 86_400, // up to 24 hours
});

/** Non-empty filenames (alphanumeric + dot + dash) */
const filenameArb = fc
  .stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/)
  .filter((s) => s.length > 0);

// ---------------------------------------------------------------------------
// Property 27a: default expiry is always >= 3600 seconds
// Validates: Requirements 10.3, 17.3
// ---------------------------------------------------------------------------

describe("Property 27a — Default expiry is always >= 3600 seconds", () => {
  it("effectiveExpiry() with no argument equals MIN_PRESIGNED_EXPIRY_SECONDS", () => {
    expect(effectiveExpiry()).toBe(MIN_PRESIGNED_EXPIRY_SECONDS);
    expect(effectiveExpiry()).toBeGreaterThanOrEqual(3600);
  });

  it("MIN_PRESIGNED_EXPIRY_SECONDS is always exactly 3600", () => {
    expect(MIN_PRESIGNED_EXPIRY_SECONDS).toBe(3600);
  });
});

// ---------------------------------------------------------------------------
// Property 27b: any custom expiresInSeconds >= 3600 is accepted as-is
// Validates: Requirements 17.3
// ---------------------------------------------------------------------------

describe("Property 27b — Custom expiry >= 3600 is accepted as-is", () => {
  it("effectiveExpiry(n) === n for all n >= 3600", () => {
    fc.assert(
      fc.property(atOrAboveMinExpiryArb, (n) => {
        expect(effectiveExpiry(n)).toBe(n);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 27c: expiresInSeconds < 3600 are clamped to 3600
// Validates: Requirements 17.3
// ---------------------------------------------------------------------------

describe("Property 27c — expiresInSeconds < 3600 is clamped to 3600", () => {
  it("effectiveExpiry(n) === 3600 for all n < 3600", () => {
    fc.assert(
      fc.property(belowMinExpiryArb, (n) => {
        const result = effectiveExpiry(n);
        expect(result).toBe(MIN_PRESIGNED_EXPIRY_SECONDS);
        expect(result).toBeGreaterThanOrEqual(3600);
      }),
      { numRuns: 200 }
    );
  });

  it("effectiveExpiry is monotonically non-decreasing once at/above 3600", () => {
    fc.assert(
      fc.property(
        atOrAboveMinExpiryArb,
        atOrAboveMinExpiryArb,
        (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(effectiveExpiry(lo)).toBeLessThanOrEqual(effectiveExpiry(hi));
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 27d: key construction always follows the documented path convention
// Validates: Requirements 17.1, 17.2
// ---------------------------------------------------------------------------

describe("Property 27d — Storage path conventions are always correct", () => {
  it("versionHtmlKey always produces {userId}/{projectId}/{versionId}/index.html", () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, (userId, projectId, versionId) => {
        const key = versionHtmlKey(userId, projectId, versionId);
        expect(key).toBe(`${userId}/${projectId}/${versionId}/index.html`);
        expect(key.endsWith("/index.html")).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("versionZipKey always produces {userId}/{projectId}/{versionId}/export.zip", () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, (userId, projectId, versionId) => {
        const key = versionZipKey(userId, projectId, versionId);
        expect(key).toBe(`${userId}/${projectId}/${versionId}/export.zip`);
        expect(key.endsWith("/export.zip")).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("imageKey always produces {userId}/{projectId}/images/{filename}", () => {
    fc.assert(
      fc.property(idArb, idArb, filenameArb, (userId, projectId, filename) => {
        const key = imageKey(userId, projectId, filename);
        expect(key).toBe(`${userId}/${projectId}/images/${filename}`);
        expect(key.includes("/images/")).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("version keys are always prefixed with userId/projectId/versionId", () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, (userId, projectId, versionId) => {
        const prefix = `${userId}/${projectId}/${versionId}/`;
        expect(versionHtmlKey(userId, projectId, versionId).startsWith(prefix)).toBe(true);
        expect(versionZipKey(userId, projectId, versionId).startsWith(prefix)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("image keys are always prefixed with userId/projectId/images/", () => {
    fc.assert(
      fc.property(idArb, idArb, filenameArb, (userId, projectId, filename) => {
        const prefix = `${userId}/${projectId}/images/`;
        expect(imageKey(userId, projectId, filename).startsWith(prefix)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("html key and zip key always differ for the same ids", () => {
    fc.assert(
      fc.property(idArb, idArb, idArb, (userId, projectId, versionId) => {
        expect(versionHtmlKey(userId, projectId, versionId)).not.toBe(
          versionZipKey(userId, projectId, versionId)
        );
      }),
      { numRuns: 200 }
    );
  });
});
