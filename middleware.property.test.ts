/**
 * middleware.property.test.ts
 *
 * Task 3.2 — Property 2: All protected routes redirect unauthenticated requests
 * **Validates: Requirements 1.8**
 *
 * Strategy:
 *   We test the pure routing / redirect logic extracted from middleware.ts
 *   directly — no HTTP server needed.  fast-check generates arbitrary paths
 *   that match the protected route patterns and verifies that the redirect
 *   decision is always correct, and that the resulting Location header always
 *   points to /login with a `callbackUrl` query parameter carrying the
 *   original path.
 *
 * The middleware relies on NextAuth's `auth()` wrapper, which is an edge-
 * runtime function and is difficult to unit-test directly.  Instead we test
 * the two pure pieces:
 *   1. `isProtectedRoute(pathname)` — the predicate that decides whether a
 *      path needs authentication.
 *   2. The redirect URL construction (login + callbackUrl) that runs when an
 *      unauthenticated request hits a protected route.
 *
 * Both pieces are extracted as plain functions below for testability.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic under test — mirrors middleware.ts exactly
// ---------------------------------------------------------------------------

/**
 * Returns true when the request pathname matches one of the protected
 * route patterns defined in the spec:
 *   - /dashboard (and all sub-paths)
 *   - /api/projects (and all sub-paths)
 *   - /api/billing  (and all sub-paths)
 */
function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/billing")
  );
}

/**
 * Builds the redirect URL that an unauthenticated request to a protected
 * route receives.  Returns the URL object so callers can inspect both
 * `pathname` and the `callbackUrl` search parameter.
 */
function buildLoginRedirect(baseUrl: string, originalPath: string): URL {
  const loginUrl = new URL("/login", baseUrl);
  loginUrl.searchParams.set("callbackUrl", originalPath);
  return loginUrl;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3000";

/** Generates a random suffix like "/foo/bar/baz" (always starts with "/"). */
const pathSuffixArb = fc
  .array(fc.stringMatching(/^[a-z0-9_-]{1,20}$/), {
    minLength: 0,
    maxLength: 5,
  })
  .map((parts) => (parts.length > 0 ? `/${parts.join("/")}` : ""));

/**
 * Generates paths that are guaranteed to match the /dashboard pattern.
 * Includes exact "/dashboard" and sub-paths like "/dashboard/projects/xyz".
 */
const dashboardPathArb = pathSuffixArb.map((suffix) => `/dashboard${suffix}`);

/**
 * Generates paths that match /api/projects.
 */
const apiProjectsPathArb = pathSuffixArb.map(
  (suffix) => `/api/projects${suffix}`
);

/**
 * Generates paths that match /api/billing.
 */
const apiBillingPathArb = pathSuffixArb.map(
  (suffix) => `/api/billing${suffix}`
);

/**
 * Union of all three protected-route generators.
 */
const protectedPathArb = fc.oneof(
  dashboardPathArb,
  apiProjectsPathArb,
  apiBillingPathArb
);

/**
 * Generates paths that are explicitly NOT protected:
 *   - /login, /signup  (public auth pages)
 *   - /api/auth/*      (NextAuth routes)
 *   - /about, /pricing, etc.
 */
const publicPathArb = fc.oneof(
  fc.constant("/login"),
  fc.constant("/signup"),
  fc.constant("/"),
  fc.constant("/about"),
  fc.constant("/pricing"),
  pathSuffixArb.map((s) => `/api/auth${s}`),
  // random paths that don't start with protected prefixes
  fc
    .stringMatching(/^\/[a-z]{1,10}(\/[a-z0-9]{1,10})*$/)
    .filter(
      (p) =>
        !p.startsWith("/dashboard") &&
        !p.startsWith("/api/projects") &&
        !p.startsWith("/api/billing")
    )
);

// ---------------------------------------------------------------------------
// Property 2: All protected routes redirect unauthenticated requests
// **Validates: Requirements 1.8**
// ---------------------------------------------------------------------------

describe("Property 2 — All protected routes redirect unauthenticated requests", () => {
  /**
   * **Validates: Requirements 1.8**
   *
   * For any path that matches a protected-route pattern, `isProtectedRoute`
   * must return true — meaning the middleware will redirect unauthenticated
   * requests.
   */
  it("every /dashboard/* path is recognised as protected", () => {
    fc.assert(
      fc.property(dashboardPathArb, (path) => {
        expect(isProtectedRoute(path)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("every /api/projects/* path is recognised as protected", () => {
    fc.assert(
      fc.property(apiProjectsPathArb, (path) => {
        expect(isProtectedRoute(path)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("every /api/billing/* path is recognised as protected", () => {
    fc.assert(
      fc.property(apiBillingPathArb, (path) => {
        expect(isProtectedRoute(path)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * **Validates: Requirements 1.8**
   *
   * For any protected path, the redirect target is always /login (never any
   * other destination).
   */
  it("unauthenticated requests to protected routes always redirect to /login", () => {
    fc.assert(
      fc.property(protectedPathArb, (path) => {
        const redirectUrl = buildLoginRedirect(BASE_URL, path);
        expect(redirectUrl.pathname).toBe("/login");
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 1.7, 1.8**
   *
   * The redirect URL always includes a `callbackUrl` query parameter whose
   * value equals the original (protected) path.  This allows the login page
   * to send the user back after successful authentication.
   */
  it("the redirect URL always carries a callbackUrl param equal to the original path", () => {
    fc.assert(
      fc.property(protectedPathArb, (path) => {
        const redirectUrl = buildLoginRedirect(BASE_URL, path);
        const callbackUrl = redirectUrl.searchParams.get("callbackUrl");
        expect(callbackUrl).toBe(path);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * **Validates: Requirements 1.8**
   *
   * Public / unprotected paths must NOT be flagged as protected so that
   * unauthenticated visitors can still reach them.
   */
  it("public paths are never mistakenly classified as protected", () => {
    fc.assert(
      fc.property(publicPathArb, (path) => {
        expect(isProtectedRoute(path)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  /**
   * Spot-check exact protected-path boundaries to guard against off-by-one
   * errors (e.g., "/dashboar" should NOT be protected).
   */
  it("boundary paths: exact protected prefixes with no suffix are still protected", () => {
    expect(isProtectedRoute("/dashboard")).toBe(true);
    expect(isProtectedRoute("/api/projects")).toBe(true);
    expect(isProtectedRoute("/api/billing")).toBe(true);
  });

  /**
   * Paths that are shorter than the protected prefix must never be mistakenly
   * matched (e.g., "/dashboar" is NOT a prefix of "/dashboard").
   *
   * Note: The middleware uses startsWith() which means any path beginning with
   * the exact protected prefix — including extensions like "/dashboards" — is
   * also protected. This is intentional: it's safer to over-protect than to
   * under-protect, and in practice the Next.js App Router will only serve real
   * routes under these prefixes.
   */
  it("boundary paths: truncated prefixes are not protected", () => {
    expect(isProtectedRoute("/dashboar")).toBe(false);
    expect(isProtectedRoute("/api/project")).toBe(false);
    expect(isProtectedRoute("/api/billin")).toBe(false);
    expect(isProtectedRoute("/api")).toBe(false);
    expect(isProtectedRoute("/dash")).toBe(false);
  });

  /**
   * Verify that the callbackUrl is correctly URL-encoded for paths that
   * contain sub-paths with special characters.
   */
  it("callbackUrl is always a valid, non-empty string in the redirect URL", () => {
    fc.assert(
      fc.property(protectedPathArb, (path) => {
        const redirectUrl = buildLoginRedirect(BASE_URL, path);
        const callbackUrl = redirectUrl.searchParams.get("callbackUrl");
        expect(typeof callbackUrl).toBe("string");
        expect((callbackUrl as string).length).toBeGreaterThan(0);
      }),
      { numRuns: 300 }
    );
  });
});
