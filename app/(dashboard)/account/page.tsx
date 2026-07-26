"use client";

/**
 * app/(dashboard)/account/page.tsx
 *
 * Account and billing page.
 * Requirements: 2.6, 13.1, 13.2, 13.3, 13.4, 19.1
 */

import { useEffect, useState } from "react";

interface LedgerEntry {
  id: string;
  eventType: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  generationJobId: string | null;
  stripePaymentId: string | null;
}

interface AccountData {
  tier: string;
  balance: number;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  DEDUCTION:    "Generation",
  TOP_UP:       "Top-up",
  REFUND:       "Refund",
  MONTHLY_GRANT:"Monthly grant",
};

export default function AccountPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  function fetchBalance() {
    fetch("/api/billing/balance")
      .then((r) => r.json())
      .then((data: AccountData) => setAccount(data))
      .catch(() => {});
  }

  useEffect(() => {
    fetchBalance();
    // Poll balance every 5 seconds (Req 13.4)
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch ledger history (we re-use the balance endpoint; in a full impl this would be a separate endpoint)
    fetch("/api/billing/balance?include=ledger")
      .then((r) => r.json())
      .then((data: { ledger?: LedgerEntry[] }) => {
        if (data.ledger) setLedger(data.ledger);
      })
      .catch(() => {});
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
        body: JSON.stringify({ priceId: process.env.NEXT_PUBLIC_TOPUP_PRICE_ID ?? "", mode: "payment" }),
      });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        window.location.href = url;
      }
    } finally {
      setIsCheckoutLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8" data-testid="account-page">
      <h1 className="text-2xl font-bold text-foreground">Account &amp; Billing</h1>

      {/* Tier and balance */}
      <section data-testid="tier-section" className="rounded-2xl border border-foreground/10 bg-background p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Subscription</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-foreground/50 uppercase tracking-wide">Current plan</p>
            <p className="mt-1 text-xl font-bold text-foreground" data-testid="tier-name">
              {account?.tier ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/50 uppercase tracking-wide">Credits</p>
            <p className="mt-1 text-xl font-bold text-foreground" data-testid="credit-balance">
              {account?.balance ?? "—"}
            </p>
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

      {/* Ledger history */}
      <section data-testid="ledger-section" className="rounded-2xl border border-foreground/10 bg-background p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Credit History</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-foreground/40">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-foreground/5">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {EVENT_TYPE_LABEL[entry.eventType] ?? entry.eventType}
                  </p>
                  <p className="text-xs text-foreground/40">
                    {new Date(entry.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {entry.stripePaymentId && ` · ${entry.stripePaymentId.slice(0, 12)}…`}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      entry.eventType === "DEDUCTION" ? "text-red-500" : "text-green-600"
                    }`}
                  >
                    {entry.eventType === "DEDUCTION" ? "-" : "+"}
                    {entry.amount}
                  </span>
                  <p className="text-xs text-foreground/40">{entry.balanceAfter} remaining</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
