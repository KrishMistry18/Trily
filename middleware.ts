/**
 * middleware.ts
 *
 * Route protection middleware.
 * NextAuth has been replaced with Firebase Auth.
 * Proper Firebase session cookie validation should be implemented here using
 * next-firebase-auth-edge or similar if server-side protection is required.
 * For now, we allow requests to proceed and rely on client-side and API route protection.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/billing")
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // NOTE: Server-side Firebase token verification requires next-firebase-auth-edge
  // or a custom implementation using Firebase Admin SDK (which cannot run on Edge).
  // This is a placeholder that allows requests to pass through to be validated
  // at the API route level or client side.

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/projects/:path*", "/api/billing/:path*"],
};
