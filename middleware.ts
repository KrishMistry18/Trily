/**
 * middleware.ts
 *
 * Route protection middleware using NextAuth v5's auth() helper.
 *
 * Protected patterns (Requirement 1.8):
 *   - /dashboard/*   — all pages inside the (dashboard) route group
 *   - /api/projects* — project API routes (require authenticated user)
 *   - /api/billing*  — billing API routes (require authenticated user)
 *
 * Unauthenticated requests to protected routes are redirected to /login
 * with a `callbackUrl` query parameter preserving the originally requested
 * URL so the user is sent back after successful login (Requirement 1.7).
 *
 * Requirements: 1.7, 1.8
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const { pathname } = req.nextUrl;

  if (isProtectedRoute(pathname) && !isAuthenticated) {
    // Build the login URL, preserving the originally requested path as
    // callbackUrl so it can be used for the post-login redirect (Req 1.7).
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow the request to continue
  return NextResponse.next();
});

/**
 * Matcher configuration — run the middleware only on the routes that could
 * be protected.  Static files, Next.js internals, and the auth routes
 * themselves are excluded so authentication flows work without being
 * intercepted.
 */
export const config = {
  matcher: [
    /*
     * Match:
     *   - /dashboard and all sub-paths
     *   - /api/projects and all sub-paths
     *   - /api/billing and all sub-paths
     *
     * Exclude:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - /api/auth/*   (NextAuth own routes — must never be protected)
     *   - /login, /signup (public auth pages)
     */
    "/dashboard/:path*",
    "/api/projects/:path*",
    "/api/billing/:path*",
  ],
};
