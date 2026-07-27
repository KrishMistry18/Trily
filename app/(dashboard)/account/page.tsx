"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

interface LedgerEntry {
  id: string;
  txId: string;
  type: string;
  amount: number;
  relatedProjectId?: string;
  timestamp: string;
}

interface AccountData {
  tier: string;
  balance: number;
  resetDate: string | null;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  generation: "Full Site Generation",
  edit: "Site Edit",
  topup: "Credit Top-up",
  grant: "Monthly Grant",
};

function formatTierInfo(tier: string) {
  switch (tier.toLowerCase()) {
    case "pro":
      return { name: "Pro Plan", price: "$19/mo" };
    case "business":
      return { name: "Business Plan", price: "$49/mo" };
    case "free":
    default:
      return { name: "Free Plan", price: "$0/mo" };
  }
}

export default function AccountPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [dailyUsage, setDailyUsage] = useState<{ date: string; spent: number }[]>([]);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  function fetchBalance() {
    fetch("/api/billing/balance")
      .then((r) => r.json())
      .then((data: AccountData) => setAccount(data))
      .catch(() => {});
  }

  function fetchTransactions() {
    fetch("/api/billing/transactions")
      .then((r) => r.json())
      .then(
        (data: {
          transactions?: LedgerEntry[];
          dailyUsage?: { date: string; spent: number }[];
        }) => {
          if (data.transactions) setLedger(data.transactions);
          if (data.dailyUsage) setDailyUsage(data.dailyUsage.reverse()); // Ensure chronological order for chart
        },
      )
      .catch(() => {});
  }

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, []);

  async function handlePortal() {
    setIsPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        window.location.href = url;
      }
    } finally {
      setIsPortalLoading(false);
    }
  }

  async function handleCheckout() {
    setIsCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: process.env.NEXT_PUBLIC_TOPUP_PRICE_ID ?? "",
          mode: "payment",
        }),
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        window.location.href = url;
      }
    } finally {
      setIsCheckoutLoading(false);
    }
  }

  const tierInfo = formatTierInfo(account?.tier ?? "free");
  const maxUsage = dailyUsage.length > 0 ? Math.max(...dailyUsage.map((d) => d.spent)) : 0;

  const totalPages = Math.ceil(ledger.length / itemsPerPage);
  const paginatedLedger = ledger.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return (
    <div className="max-w-2xl space-y-8" data-testid="account-page">
      <h1 className="text-2xl font-bold text-foreground">Account &amp; Billing</h1>

      {/* Tier and balance */}
      <section
        data-testid="tier-section"
        className="rounded-2xl border border-foreground/10 bg-background p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-foreground/50 uppercase tracking-wide">Current plan</p>
            <p className="mt-1 text-xl font-bold text-foreground" data-testid="tier-name">
              {account ? `${tierInfo.name} (${tierInfo.price})` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/50 uppercase tracking-wide">Credits remaining</p>
            <p className="mt-1 text-xl font-bold text-foreground" data-testid="credit-balance">
              {account?.balance ?? "—"}
            </p>
            {account?.resetDate && (
              <p className="text-xs text-foreground/40 mt-1">
                Resets on{" "}
                {new Date(account.resetDate).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handlePortal}
            disabled={isPortalLoading}
            data-testid="manage-subscription-btn"
            className="rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 disabled:opacity-50 transition"
          >
            {isPortalLoading ? "Loading…" : "Manage Subscription"}
          </button>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isCheckoutLoading}
            data-testid="buy-credits-btn"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {isCheckoutLoading ? "Loading…" : "Buy Credits"}
          </button>
        </div>
      </section>

      {/* Usage Chart */}
      {dailyUsage.some((d) => d.spent > 0) && (
        <section className="rounded-2xl border border-foreground/10 bg-background p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Usage (Last 30 Days)</h2>
          <div className="flex items-end gap-1 h-32 mt-4 pt-4 border-b border-foreground/5 relative">
            {maxUsage > 0 && (
              <span className="absolute top-0 left-0 text-xs text-foreground/30 -translate-y-full">
                {maxUsage}
              </span>
            )}
            {dailyUsage.map((day, idx) => (
              <div
                key={idx}
                className="flex-1 bg-primary/20 hover:bg-primary transition-colors rounded-t-sm group relative"
                style={{ height: maxUsage > 0 ? `${(day.spent / maxUsage) * 100}%` : "0%" }}
              >
                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full mb-2 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs py-1 px-2 rounded pointer-events-none whitespace-nowrap z-10">
                  {new Date(day.date).toLocaleDateString([], { month: "short", day: "numeric" })}:{" "}
                  {day.spent} credits
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ledger history */}
      <section
        data-testid="ledger-section"
        className="rounded-2xl border border-foreground/10 bg-background p-6 space-y-4"
      >
        <h2 className="text-lg font-semibold text-foreground">Credit History</h2>

        {ledger.length === 0 ? (
          <div className="py-8 text-center space-y-4">
            <p className="text-sm text-foreground/60">
              No activity yet — generate your first site to get started.
            </p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-foreground/5">
              {paginatedLedger.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {EVENT_TYPE_LABEL[entry.type] ?? entry.type}
                    </p>
                    <p className="text-xs text-foreground/40 mt-0.5">
                      {new Date(entry.timestamp).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {entry.relatedProjectId &&
                        ` · Project: ${entry.relatedProjectId.slice(0, 8)}…`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        entry.amount < 0 ? "text-foreground" : "text-green-500"
                      }`}
                    >
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-foreground/5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-foreground/5 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  Previous
                </button>
                <span className="text-sm text-foreground/50">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-foreground/5 disabled:opacity-30 disabled:pointer-events-none transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
