/**
 * auth.ts
 *
 * NextAuth v5 configuration.
 *
 * Providers:
 *   - CredentialsProvider: email/password sign-in with bcrypt verification.
 *     Password must be at least 8 characters (validated at sign-up; verified
 *     here by comparing the hash stored in the DB).
 *   - GoogleProvider: OAuth 2.0 — creates or links a User account using the
 *     verified Google email address.
 *
 * Session strategy: JWT (edge-compatible; no DB round-trip on every request).
 * Adapter: @auth/prisma-adapter — keeps User/Account records in Postgres.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Augment session types so req.auth.user.id is typed throughout the app.
// ---------------------------------------------------------------------------
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// ---------------------------------------------------------------------------
// Validation schema for credentials sign-in
// ---------------------------------------------------------------------------
const credentialsSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),

  // JWT strategy is required for edge-compatible middleware
  session: { strategy: "jwt" },

  // Idle timeout: 24 hours (Requirement 1.5)
  // NextAuth sets maxAge on the cookie; we map it through the jwt callback.
  jwt: { maxAge: 24 * 60 * 60 },

  providers: [
    // ------------------------------------------------------------------
    // Credentials — email + bcrypt password
    // ------------------------------------------------------------------
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate shape first
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          // Return null — NextAuth will surface a generic "CredentialsSignin"
          // error; the UI maps this to the information-safe message required
          // by Requirement 1.6.
          return null;
        }

        const { email, password } = parsed.data;

        // Fetch the user record
        const user = await db.user.findUnique({ where: { email } });

        // No user found, or account has no password (OAuth-only account)
        if (!user || !user.passwordHash) {
          // Deliberate: do NOT reveal whether the email exists (Req 1.6)
          return null;
        }

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) {
          // Again: generic failure — no hint as to which field failed (Req 1.6)
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),

    // ------------------------------------------------------------------
    // Google OAuth 2.0
    // ------------------------------------------------------------------
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    // Persist the user id into the JWT so it is accessible in the session
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    // Expose id on the session object for convenience
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});
