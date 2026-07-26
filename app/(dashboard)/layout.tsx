/**
 * app/(dashboard)/layout.tsx
 *
 * Shared dashboard layout — navigation bar with logo, user menu, and
 * credit balance display.
 *
 * Requirements: 12.1, 13.1, 19.1
 */

import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// Credit balance display — fetched server-side
// ---------------------------------------------------------------------------
async function CreditBalance({ userId }: { userId: string }) {
  try {
    // Import db only on server
    const { db } = await import("@/lib/db");
    const latest = await db.creditLedger.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { balanceAfter: true },
    });
    const balance = latest?.balanceAfter ?? 0;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
        <span aria-hidden="true">⚡</span>
        {balance} credits
      </span>
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Nav bar
// ---------------------------------------------------------------------------
async function DashboardNav({ userName, userId }: { userName: string; userId: string }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-foreground/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-foreground text-xl"
        >
          <span className="text-primary text-2xl">◉</span>
          Orbis
        </Link>

        {/* Right side — credit balance + user menu */}
        <div className="flex items-center gap-3">
          <CreditBalance userId={userId} />

          {/* User menu */}
          <div className="flex items-center gap-2">
            {/* Account link */}
            <Link
              href="/account"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition"
            >
              {userName}
            </Link>

            {/* Sign out */}
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/60 hover:bg-foreground/5 hover:text-foreground transition"
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
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userName =
    session.user.name ?? session.user.email?.split("@")[0] ?? "User";

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav userName={userName} userId={session.user.id} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
