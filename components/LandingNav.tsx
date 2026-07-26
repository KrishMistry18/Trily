"use client";

import React, { useEffect, useState } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/Button";

export function LandingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/80 backdrop-blur-lg border-b border-white/10 shadow-lg"
          : "bg-transparent border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center font-display font-bold text-xl shadow-[0_0_15px_rgba(139,92,246,0.3)]">
            T
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-white">Trily</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/70">
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How it Works
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a href="#testimonials" className="hover:text-white transition-colors">
            Testimonials
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <Link href="/dashboard">
              <Button variant="secondary" className="px-5 py-2 text-sm">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:block text-sm font-medium text-white/70 hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link href="/login">
                <Button variant="primary" className="px-5 py-2 text-sm">
                  Start Free
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
