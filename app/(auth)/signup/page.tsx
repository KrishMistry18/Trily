"use client";

/**
 * app/(auth)/signup/page.tsx
 *
 * Sign-up page — email/password registration form.
 * Uses Firebase Auth and sets a session cookie on the server.
 */
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { z } from "zod";

import { auth } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const signupSchema = z
  .object({
    name: z.string().max(255).optional(),
    email: z.string().email("Please enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

// ---------------------------------------------------------------------------
// Inner form component that uses useSearchParams (must be wrapped in Suspense)
// ---------------------------------------------------------------------------
function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  // Helper to set the server-side session cookie
  async function setSessionCookie(idToken: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("Failed to create session");
  }

  // -------------------------------------------------------------------------
  // Submit handler
  // -------------------------------------------------------------------------
  async function onSubmit(values: SignupFormValues) {
    setServerError(null);

    try {
      // 1. Create the user account in Firebase Auth
      const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);

      // 2. Update their profile name if provided
      if (values.name) {
        await updateProfile(cred.user, { displayName: values.name });
      }

      // 3. Establish session by setting the cookie
      const token = await cred.user.getIdToken();
      await setSessionCookie(token);

      // 4. Navigate to the callback URL
      router.push(callbackUrl);
      router.refresh();
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        setError("email", { message: "An account with this email address already exists" });
      } else if (error.code === "auth/weak-password") {
        setError("password", { message: "Password is too weak" });
      } else {
        setServerError(error.message || "Sign-up failed. Please try again.");
      }
    }
  }

  return (
    <div className="bg-background border border-foreground/10 rounded-2xl shadow-lg p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h1>
        <p className="text-sm text-foreground/60">Start generating websites with Orbis</p>
      </div>

      {/* Server-level error */}
      {serverError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
        >
          {serverError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Name (optional) */}
        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Name <span className="text-foreground/40 font-normal">(optional)</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            aria-describedby={errors.name ? "name-error" : undefined}
            aria-invalid={!!errors.name}
            {...register("name")}
            className="block w-full rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground placeholder-foreground/40 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            placeholder="Your name"
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-red-600" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-describedby={errors.email ? "email-error" : undefined}
            aria-invalid={!!errors.email}
            {...register("email")}
            className="block w-full rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground placeholder-foreground/40 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            placeholder="you@example.com"
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-red-600" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={!!errors.password}
            {...register("password")}
            className="block w-full rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground placeholder-foreground/40 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            placeholder="••••••••"
          />
          {errors.password && (
            <p id="password-error" className="text-xs text-red-600" role="alert">
              {errors.password.message}
            </p>
          )}
          {!errors.password && (
            <p className="text-xs text-foreground/40">Must be at least 8 characters</p>
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
            className="block w-full rounded-lg border border-foreground/20 bg-background px-3 py-2.5 text-sm text-foreground placeholder-foreground/40 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p id="confirm-password-error" className="text-xs text-red-600" role="alert">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>

      {/* Sign-in link */}
      <p className="text-center text-sm text-foreground/60">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — wraps inner component in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------
export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background border border-foreground/10 rounded-2xl shadow-lg p-8 flex justify-center">
          <svg
            className="animate-spin h-6 w-6 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Loading"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
