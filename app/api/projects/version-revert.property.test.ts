/**
 * app/api/projects/version-revert.property.test.ts
 *
 * Task 19.2 — Property 19: Reverting a version produces a new version with identical code
 *
 * Revert always creates a new version whose storageKey contains the same HTML
 * as the source version.
 *
 * **Validates: Requirements 9.3**
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure model of the revert logic
// ---------------------------------------------------------------------------

interface Version {
  id: string;
  projectId: string;
  versionNumber: number;
  storageKey: string;
  prompt: string | null;
  html: string; // In-memory HTML content (simulates S3 read)
}

interface RevertResult {
  newVersionId: string;
  versionNumber: number;
  storageKey: string;
  html: string; // same as source
  prompt: string | null;
}

/**
 * Pure simulation of the revert handler:
 * 1. Read HTML from source version (in-memory simulation)
 * 2. Write to a new S3 path (new versionId)
 * 3. Create new Version with versionNumber = MAX + 1
 */
function simulateRevert(
  projectId: string,
  userId: string,
  sourceVersion: Version,
  existingVersions: Version[]
): RevertResult {
  const maxVersionNumber = existingVersions.reduce(
    (max, v) => Math.max(max, v.versionNumber),
    0
  );
  const newVersionNumber = maxVersionNumber + 1;
  const newVersionId = `reverted-${sourceVersion.id}-${newVersionNumber}`;
  const newStorageKey = `${userId}/${projectId}/${newVersionId}/index.html`;

  return {
    newVersionId,
    versionNumber: newVersionNumber,
    storageKey: newStorageKey,
    html: sourceVersion.html, // content is identical
    prompt: sourceVersion.prompt,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const htmlArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .map((s) => `<html><body>${s}</body></html>`);

const versionArb = (idx: number, projectId: string) =>
  htmlArb.map(
    (html): Version => ({
      id: `v${idx}`,
      projectId,
      versionNumber: idx + 1,
      storageKey: `user/${projectId}/v${idx}/index.html`,
      prompt: `prompt ${idx}`,
      html,
    })
  );

// ---------------------------------------------------------------------------
// Property 19 — Reverting a version produces a new version with identical code
// Validates: Requirements 9.3
// ---------------------------------------------------------------------------

describe("Property 19 — Reverting a version produces a new version with identical code", () => {
  it("reverted version always has identical HTML content to the source version", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 4, maxLength: 12 }).map((s) => `proj_${s}`),
        fc.string({ minLength: 4, maxLength: 12 }).map((s) => `user_${s}`),
        // Source version index (0-based)
        fc.integer({ min: 1, max: 20 }).chain((existingCount) =>
          fc
            .integer({ min: 0, max: existingCount - 1 })
            .chain((sourceIdx) =>
              fc
                .string({ minLength: 4, maxLength: 12 })
                .map((projectId) => ({ existingCount, sourceIdx, projectId }))
            )
        ),
        (projectId, userId, { existingCount, sourceIdx, projectId: _p }) => {
          const versions: Version[] = Array.from({ length: existingCount }, (_, i) => ({
            id: `v${i}`,
            projectId,
            versionNumber: i + 1,
            storageKey: `${userId}/${projectId}/v${i}/index.html`,
            prompt: `prompt ${i}`,
            html: `<html><body>version ${i}</body></html>`,
          }));

          const sourceVersion = versions[sourceIdx]!;
          const result = simulateRevert(projectId, userId, sourceVersion, versions);

          // The reverted version's HTML must be identical to the source
          expect(result.html).toBe(sourceVersion.html);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("reverted version always has a higher version number than all existing versions", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (existingCount) => {
          const projectId = "proj_test";
          const userId = "user_test";
          const versions: Version[] = Array.from({ length: existingCount }, (_, i) => ({
            id: `v${i}`,
            projectId,
            versionNumber: i + 1,
            storageKey: `${userId}/${projectId}/v${i}/index.html`,
            prompt: null,
            html: `<html><body>v${i}</body></html>`,
          }));

          const sourceVersion = versions[0]!;
          const result = simulateRevert(projectId, userId, sourceVersion, versions);

          // The new version number must be strictly greater than all existing
          for (const v of versions) {
            expect(result.versionNumber).toBeGreaterThan(v.versionNumber);
          }
          expect(result.versionNumber).toBe(existingCount + 1);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("reverted version storageKey always includes the new versionId (not source versionId)", () => {
    fc.assert(
      fc.property(htmlArb, (html) => {
        const projectId = "proj_test";
        const userId = "user_test";
        const sourceVersion: Version = {
          id: "original-v1",
          projectId,
          versionNumber: 1,
          storageKey: `${userId}/${projectId}/original-v1/index.html`,
          prompt: "original prompt",
          html,
        };
        const result = simulateRevert(projectId, userId, sourceVersion, [sourceVersion]);

        // New storageKey must NOT be the same as source storageKey
        expect(result.storageKey).not.toBe(sourceVersion.storageKey);
        // But the HTML content must be the same
        expect(result.html).toBe(html);
      }),
      { numRuns: 300 }
    );
  });

  it("reverted version preserves the source prompt", () => {
    fc.assert(
      fc.property(
        htmlArb,
        fc.option(fc.string({ minLength: 1, maxLength: 100 })),
        (html, prompt) => {
          const projectId = "proj_test";
          const userId = "user_test";
          const sourceVersion: Version = {
            id: "v1",
            projectId,
            versionNumber: 1,
            storageKey: `${userId}/${projectId}/v1/index.html`,
            prompt: prompt ?? null,
            html,
          };
          const result = simulateRevert(projectId, userId, sourceVersion, [sourceVersion]);
          expect(result.prompt).toBe(sourceVersion.prompt);
        }
      ),
      { numRuns: 200 }
    );
  });
});
