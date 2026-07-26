"use client";

import React, { useState } from "react";

import Link from "next/link";

import { EDIT_COST, FULL_GENERATION_COST, SUBSCRIPTION_TIERS } from "@/lib/billing/config";

import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

export function PricingSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [isAnnual, setIsAnnual] = useState(false);
  const ctaLink = isLoggedIn ? "/dashboard" : "/login";

  return (
    <section id="pricing" className="py-24 bg-[#050508] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-violet-600/10 rounded-full mix-blend-screen filter blur-[150px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-6 text-lg text-white/60">
            Start for free, upgrade when you need more power.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 p-1 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${!isAnnual ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${isAnnual ? "bg-white text-black shadow-sm" : "text-white/60 hover:text-white"}`}
            >
              Annually{" "}
              <span className={isAnnual ? "text-indigo-600" : "text-fuchsia-400"}>Save 20%</span>
            </button>
          </div>

          <p className="mt-8 text-sm text-white/40 font-medium">
            Generations cost {FULL_GENERATION_COST} credits. Edits cost {EDIT_COST} credits.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
          {/* Free Tier */}
          <GlassCard className="p-8 flex flex-col h-[500px]">
            <h3 className="text-xl font-bold text-white">Free</h3>
            <div className="mt-4 flex items-baseline text-5xl font-extrabold text-white">
              $0
              <span className="ml-1 text-xl font-medium text-white/40">/mo</span>
            </div>
            <p className="mt-4 text-white/60 font-medium">
              {SUBSCRIPTION_TIERS.free.monthlyCredits} Credits / month
            </p>
            <ul className="mt-8 space-y-4 flex-1">
              <li className="flex gap-3 text-white/80">
                <svg
                  className="w-5 h-5 text-indigo-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>
                  ~{Math.floor(SUBSCRIPTION_TIERS.free.monthlyCredits / FULL_GENERATION_COST)} site
                  generations
                </span>
              </li>
              {SUBSCRIPTION_TIERS.free.features.map((feature, i) => (
                <li key={i} className="flex gap-3 text-white/80">
                  <svg
                    className="w-5 h-5 text-indigo-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href={ctaLink} className="mt-8 block w-full">
              <Button variant="secondary" className="w-full py-6">
                Start Building Free
              </Button>
            </Link>
          </GlassCard>

          {/* Pro Tier (Elevated) */}
          <div className="relative z-10 md:scale-105">
            <div className="absolute -inset-[1px] bg-gradient-to-b from-indigo-500 via-fuchsia-500 to-transparent rounded-3xl opacity-50 blur-[2px]"></div>
            <GlassCard className="relative p-8 flex flex-col h-[540px] border border-white/20 bg-background/80 backdrop-blur-xl">
              <div className="absolute -top-4 inset-x-0 flex justify-center">
                <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full shadow-lg">
                  Most Popular
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mt-2">Pro</h3>
              <div className="mt-4 flex items-baseline text-5xl font-extrabold text-white">
                $
                {isAnnual
                  ? SUBSCRIPTION_TIERS.pro.annualPrice
                  : SUBSCRIPTION_TIERS.pro.monthlyPrice}
                <span className="ml-1 text-xl font-medium text-white/40">/mo</span>
              </div>
              <p className="mt-4 text-white/60 font-medium">
                {SUBSCRIPTION_TIERS.pro.monthlyCredits} Credits / month
              </p>
              <ul className="mt-8 space-y-4 flex-1">
                <li className="flex gap-3 text-white">
                  <svg
                    className="w-5 h-5 text-fuchsia-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="3"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="font-semibold">
                    ~{Math.floor(SUBSCRIPTION_TIERS.pro.monthlyCredits / FULL_GENERATION_COST)} site
                    generations
                  </span>
                </li>
                {SUBSCRIPTION_TIERS.pro.features.map((feature, i) => (
                  <li key={i} className="flex gap-3 text-white/90">
                    <svg
                      className="w-5 h-5 text-fuchsia-400 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href={ctaLink} className="mt-8 block w-full">
                <Button
                  variant="primary"
                  className="w-full py-6 text-base font-bold shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                >
                  Upgrade to Pro
                </Button>
              </Link>
            </GlassCard>
          </div>

          {/* Business Tier */}
          <GlassCard className="p-8 flex flex-col h-[500px]">
            <h3 className="text-xl font-bold text-white">Business</h3>
            <div className="mt-4 flex items-baseline text-5xl font-extrabold text-white">
              $
              {isAnnual
                ? SUBSCRIPTION_TIERS.business.annualPrice
                : SUBSCRIPTION_TIERS.business.monthlyPrice}
              <span className="ml-1 text-xl font-medium text-white/40">/mo</span>
            </div>
            <p className="mt-4 text-white/60 font-medium">
              {SUBSCRIPTION_TIERS.business.monthlyCredits} Credits / month
            </p>
            <ul className="mt-8 space-y-4 flex-1">
              <li className="flex gap-3 text-white/80">
                <svg
                  className="w-5 h-5 text-indigo-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>
                  ~{Math.floor(SUBSCRIPTION_TIERS.business.monthlyCredits / FULL_GENERATION_COST)}{" "}
                  site generations
                </span>
              </li>
              {SUBSCRIPTION_TIERS.business.features.map((feature, i) => (
                <li key={i} className="flex gap-3 text-white/80">
                  <svg
                    className="w-5 h-5 text-indigo-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href={ctaLink} className="mt-8 block w-full">
              <Button variant="secondary" className="w-full py-6">
                Contact Sales
              </Button>
            </Link>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
