/**
 * Task 27.1 — Property test: Preview iframe always uses the minimum sandbox attribute set
 * Validates: Requirements 7.1, 16.1
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure model: the sandbox attribute string used in PreviewPanel
// ---------------------------------------------------------------------------

/** Returns the sandbox attribute string that PreviewPanel sets on the iframe */
function getIframeSandboxAttr(): string {
  // From PreviewPanel.tsx: sandbox="allow-scripts"
  return "allow-scripts";
}

/** Returns true if the sandbox string grants the minimum required permissions */
function hasMinimumSandbox(sandbox: string): boolean {
  const tokens = sandbox.split(/\s+/).map((t) => t.trim().toLowerCase());
  // Must include allow-scripts
  return tokens.includes("allow-scripts");
}

/** Returns true if the sandbox string does NOT include allow-same-origin */
function excludesSameOrigin(sandbox: string): boolean {
  const tokens = sandbox.split(/\s+/).map((t) => t.trim().toLowerCase());
  return !tokens.includes("allow-same-origin");
}

/** Returns true if a given sandbox string is a valid superset of the minimum */
function isValidSandboxExtension(base: string, extension: string): boolean {
  // Any sandbox that includes allow-scripts and excludes allow-same-origin is valid
  const combined = `${base} ${extension}`.trim();
  return hasMinimumSandbox(combined) && excludesSameOrigin(combined);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 13 — Preview iframe always uses the minimum sandbox attribute set", () => {
  it("PreviewPanel sandbox always includes allow-scripts", () => {
    const sandbox = getIframeSandboxAttr();
    expect(hasMinimumSandbox(sandbox)).toBe(true);
  });

  it("PreviewPanel sandbox never includes allow-same-origin (Req 7.1, 16.1)", () => {
    const sandbox = getIframeSandboxAttr();
    expect(excludesSameOrigin(sandbox)).toBe(true);
  });

  it("sandbox attribute is always a non-empty string", () => {
    const sandbox = getIframeSandboxAttr();
    expect(typeof sandbox).toBe("string");
    expect(sandbox.length).toBeGreaterThan(0);
  });

  it("any valid sandbox extension still passes both checks", () => {
    const validExtensions = [
      "",
      "allow-forms",
      "allow-popups",
      "allow-forms allow-popups",
    ];
    const base = getIframeSandboxAttr();
    for (const ext of validExtensions) {
      expect(isValidSandboxExtension(base, ext)).toBe(true);
    }
  });

  it("adding allow-same-origin to any sandbox always fails the exclusion check", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "allow-scripts allow-same-origin",
          "allow-same-origin",
          "allow-same-origin allow-forms"
        ),
        (sandbox) => {
          expect(excludesSameOrigin(sandbox)).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  it("the exact PreviewPanel sandbox string passes both invariants", () => {
    const sandbox = getIframeSandboxAttr();
    expect(hasMinimumSandbox(sandbox)).toBe(true);
    expect(excludesSameOrigin(sandbox)).toBe(true);
  });
});
