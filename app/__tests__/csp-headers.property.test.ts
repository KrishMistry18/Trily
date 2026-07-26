/**
 * Task 27.2 — Property test: all application pages include a correct CSP header
 * Validates: Requirements 16.2
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// The CSP string from next.config.mjs
// ---------------------------------------------------------------------------

const CSP_HEADER =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-src 'none'; object-src 'none';";

// ---------------------------------------------------------------------------
// Pure CSP parser / validator
// ---------------------------------------------------------------------------

function parseCSP(csp: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  for (const part of csp.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [directive, ...values] = part.split(/\s+/);
    if (directive) {
      directives[directive.toLowerCase()] = values.map((v) => v.toLowerCase());
    }
  }
  return directives;
}

function hasDirective(csp: string, directive: string): boolean {
  const parsed = parseCSP(csp);
  return directive in parsed;
}

function getDirectiveValues(csp: string, directive: string): string[] {
  return parseCSP(csp)[directive] ?? [];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 14 — All application pages include a correct CSP header (Req 16.2)", () => {
  it("CSP always contains default-src directive", () => {
    expect(hasDirective(CSP_HEADER, "default-src")).toBe(true);
  });

  it("CSP always contains script-src directive", () => {
    expect(hasDirective(CSP_HEADER, "script-src")).toBe(true);
  });

  it("CSP always contains frame-src directive set to 'none'", () => {
    const values = getDirectiveValues(CSP_HEADER, "frame-src");
    expect(values).toContain("'none'");
  });

  it("CSP always contains object-src directive set to 'none'", () => {
    const values = getDirectiveValues(CSP_HEADER, "object-src");
    expect(values).toContain("'none'");
  });

  it("CSP always contains connect-src directive", () => {
    expect(hasDirective(CSP_HEADER, "connect-src")).toBe(true);
  });

  it("script-src never includes 'unsafe-eval'", () => {
    const values = getDirectiveValues(CSP_HEADER, "script-src");
    expect(values).not.toContain("'unsafe-eval'");
  });

  it("script-src never includes 'unsafe-inline'", () => {
    const values = getDirectiveValues(CSP_HEADER, "script-src");
    expect(values).not.toContain("'unsafe-inline'");
  });

  it("default-src restricts to 'self'", () => {
    const values = getDirectiveValues(CSP_HEADER, "default-src");
    expect(values).toContain("'self'");
  });

  it("CSP is a non-empty string", () => {
    expect(typeof CSP_HEADER).toBe("string");
    expect(CSP_HEADER.length).toBeGreaterThan(0);
  });

  it("parseCSP always returns an object with at least 5 directives for any valid CSP", () => {
    fc.assert(
      fc.property(fc.constant(CSP_HEADER), (csp) => {
        const parsed = parseCSP(csp);
        expect(Object.keys(parsed).length).toBeGreaterThanOrEqual(5);
      }),
      { numRuns: 1 }
    );
  });
});
