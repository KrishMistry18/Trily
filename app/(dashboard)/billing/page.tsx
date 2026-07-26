import { redirect } from "next/navigation";

import {
  createCustomerPortalSessionAction,
  createSubscriptionCheckoutSessionAction,
  createTopUpCheckoutSessionAction,
} from "@/app/actions/billing";
import { auth } from "@/auth";

import { db } from "@/lib/db";

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userDoc = await db.collection("users").doc(session.user.id).get();
  const userData = userDoc.data();
  const tier = userData?.subscriptionTier || "free";
  const creditsBalance = userData?.creditsBalance || 0;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Billing & Credits</h1>

      {/* Current Plan Overview */}
      <section className="bg-card border rounded-lg p-6 mb-8 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground">
              You are currently on the{" "}
              <strong className="text-foreground capitalize">{tier}</strong> tier.
            </p>
            <p className="text-muted-foreground mt-1">
              Credit Balance: <span className="font-bold text-primary">{creditsBalance}</span>
            </p>
          </div>
          <div>
            <form action={createCustomerPortalSessionAction}>
              <button
                type="submit"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md font-medium"
              >
                Manage Subscription
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Subscription Upgrades */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Upgrade Subscription</h2>
          <div className="space-y-4">
            <div className="border rounded-lg p-4 flex justify-between items-center bg-card">
              <div>
                <h3 className="font-medium">Pro Tier</h3>
                <p className="text-sm text-muted-foreground">1,000 credits / month</p>
              </div>
              <form action={createSubscriptionCheckoutSessionAction.bind(null, "pro")}>
                <button
                  type="submit"
                  disabled={tier === "pro"}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {tier === "pro" ? "Current Plan" : "Upgrade"}
                </button>
              </form>
            </div>
            <div className="border rounded-lg p-4 flex justify-between items-center bg-card">
              <div>
                <h3 className="font-medium">Business Tier</h3>
                <p className="text-sm text-muted-foreground">5,000 credits / month</p>
              </div>
              <form action={createSubscriptionCheckoutSessionAction.bind(null, "business")}>
                <button
                  type="submit"
                  disabled={tier === "business"}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {tier === "business" ? "Current Plan" : "Upgrade"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Top-up Packs */}
        <section>
          <h2 className="text-xl font-semibold mb-4">One-time Top-ups</h2>
          <div className="space-y-4">
            <div className="border rounded-lg p-4 flex justify-between items-center bg-card">
              <div>
                <h3 className="font-medium">Small Pack</h3>
                <p className="text-sm text-muted-foreground">+100 credits</p>
              </div>
              <form action={createTopUpCheckoutSessionAction.bind(null, "small")}>
                <button
                  type="submit"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Buy
                </button>
              </form>
            </div>
            <div className="border rounded-lg p-4 flex justify-between items-center bg-card">
              <div>
                <h3 className="font-medium">Medium Pack</h3>
                <p className="text-sm text-muted-foreground">+500 credits</p>
              </div>
              <form action={createTopUpCheckoutSessionAction.bind(null, "medium")}>
                <button
                  type="submit"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Buy
                </button>
              </form>
            </div>
            <div className="border rounded-lg p-4 flex justify-between items-center bg-card">
              <div>
                <h3 className="font-medium">Large Pack</h3>
                <p className="text-sm text-muted-foreground">+2,000 credits</p>
              </div>
              <form action={createTopUpCheckoutSessionAction.bind(null, "large")}>
                <button
                  type="submit"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Buy
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
