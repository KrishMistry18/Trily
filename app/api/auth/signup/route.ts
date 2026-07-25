/**
 * app/api/auth/signup/route.ts
 *
 * Custom sign-up route handler.
 *
 * Flow (Requirement 1.3):
 *   1. Validate email format and password length (≥ 8 chars) — Req 1.1.
 *   2. Check for existing user with the same email — Req 1.4.
 *   3. Hash the password with bcrypt (cost factor 12).
 *   4. INSERT the User record via Prisma.
 *   5. Return success so the client can proceed to sign-in.
 *
 * This route does NOT issue the session itself; the client should call
 * NextAuth's signIn('credentials', ...) after a 201 response to obtain
 * the session cookie.
 *
 * Requirements: 1.1, 1.3, 1.4
 */

import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Request body schema
// ---------------------------------------------------------------------------
const signupBodySchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  name: z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  // Validate input
  const parsed = signupBodySchema.safeParse(body);
  if (!parsed.success) {
    // Return field-specific validation errors (Requirement 1.4)
    const errors = parsed.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: errors,
      },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  // Check for duplicate email (Requirement 1.4)
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: "Validation failed",
        fields: { email: ["An account with this email address already exists"] },
      },
      { status: 400 }
    );
  }

  // Hash password — cost factor 12 is a good balance of security and speed
  const passwordHash = await bcrypt.hash(password, 12);

  // Insert User record (Requirement 1.3)
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      name: name ?? null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    { status: 201 }
  );
}
