/**
 * app/api/auth/[...nextauth]/route.ts
 *
 * NextAuth v5 catch-all route handler.
 * Delegates all auth-related GET and POST requests (OAuth callbacks,
 * session refresh, CSRF token, sign-out, etc.) to the NextAuth handlers
 * exported from auth.ts.
 *
 * Requirements: 1.2, 1.3, 1.5
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
