"use client";

/**
 * app/(auth)/login/page.tsx
 *
 * Login page — email/password credentials form + Google OAuth button.
 *
 * Flow:
 *  - Email/password: calls NextAuth signIn('credentials', { email, password, callbackUrl })
 *  - Google OAuth: calls signIn('google', { callbackUrl })
 *  - On auth failure: displays a generic "Invalid email or password" message
 *    (information-safe — never reveals which field failed, Req 1.6)
 *  - Reads callbackUrl from URL search params for post-login redirect (Req 1.7)
 *
 * Requirements: 1.1, 1.6, 1.7, 19.1
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Google icon SVG (inline, no external dependency)
// ---------------------------------------------------------------------------
function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-5 h-5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Inner component that uses useSearchParams (must be wrapped in Suspense)
// ---------------------------------------------------------------------------
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // -------------------------------------------------------------------------
  // Credentials sign-in
  // -------------------------------------------------------------------------
  async function onSubmit(values: LoginFormValues) {
    setAuthError(null);

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      callbackUrl,
      redirect: false,
    });

    if (!result) {
      setAuthError("An unexpected error occurred. Please try again.");
      return;
    }

    if (result.error) {
      // Generic message regardless of whether email or password is wrong (Req 1.6)
      setAuthError("Invalid email or password.");
      return;
    }

    // Success — navigate to the callback URL
    router.push(result.url ?? callbackUrl);
    router.refresh();
  }

  // -------------------------------------------------------------------------
  // Google OAuth sign-in
  // -------------------------------------------------------------------------
  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    setAuthError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setAuthError("Failed to initiate Google sign-in. Please try again.");
      setIsGoogleLoading(false);
    }
  }

  return (
    <div className="bg-background border border-foreground/10 rounded-2xl shadow-lg p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-foreground/60">Sign in to your Orbis account</p>
      </div>

      {/* Auth-level error (information-safe, Req 1.6) */}
      {authError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
        >
          {authError}
        </div>
      )}

      {/* Email/password form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Email field */}
        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground"
          >
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

        {/* Password field */}
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
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
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-foreground/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-foreground/40">or continue with</span>
        </div>
      </div>

      {/* Google OAuth button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleLoading || isSubmitting}
        className="w-full flex justify-center items-center gap-3 rounded-lg border border-foreground/20 bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isGoogleLoading ? (
          <svg
            className="animate-spin h-4 w-4 text-foreground"
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
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </button>

      {/* Sign-up link */}
      <p className="text-center text-sm text-foreground/60">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — wraps inner component in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------
export default function LoginPage() {
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
      <LoginForm />
    </Suspense>
  );
}
