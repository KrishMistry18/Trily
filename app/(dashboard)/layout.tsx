/**
 * app/(dashboard)/layout.tsx
 *
 * Shared dashboard layout — navigation bar with logo, user menu, and
 * credit balance display.
 *
 * Requirements: 12.1, 13.1, 19.1
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { db } from "@/lib/db";

import { OnboardingTour } from "@/components/OnboardingTour";

// ---------------------------------------------------------------------------
// Credit balance display — fetched server-side
// ---------------------------------------------------------------------------
async function CreditBalance({ userId }: { userId: string }) {
  try {
    const { getCreditsBalance } = await import("@/lib/billing/credits");
    const balance = await getCreditsBalance(userId);
    return (
      <span className="tour-credit-balance inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-400 backdrop-blur-sm shadow-inner shadow-indigo-500/10">
        <span aria-hidden="true">⚡</span>
        {balance} credits
      </span>
    );
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Nav bar
// ---------------------------------------------------------------------------
async function DashboardNav({ userName, userId }: { userName: string; userId: string }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#050508]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#050508]/60">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-display font-bold text-white text-xl"
        >
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 text-2xl">
            ◉
          </span>
          Trily
        </Link>

        {/* Right side — credit balance + user menu */}
        <div className="flex items-center gap-3">
          <CreditBalance userId={userId} />

          {/* User menu */}
          <div className="flex items-center gap-2">
            {/* Account link */}
            <Link
              href="/account"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition"
            >
              {userName}
            </Link>

            {/* Sign out */}
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userName = session.user.name ?? session.user.email?.split("@")[0] ?? "User";

  let hasSeenOnboarding = false;
  try {
    const userDoc = await db.collection("users").doc(session.user.id).get();
    hasSeenOnboarding = userDoc.data()?.hasSeenOnboarding === true;
  } catch (err) {
    console.error("Failed to fetch user doc for onboarding state:", err);
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white">
      {!hasSeenOnboarding && <OnboardingTour />}
      <DashboardNav userName={userName} userId={session.user.id} />
      <main className="mx-auto max-w-7xl px-4 py-6 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"></div>
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
}
