"use client";

import React, { useState } from "react";

import { ExampleCard } from "@/components/ExampleCard";
import { LandingNav } from "@/components/LandingNav";

import { OfficialExample } from "@/types/db";

export function ClientGallery({
  examples,
  isLoggedIn,
}: {
  examples: OfficialExample[];
  isLoggedIn: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const industries = ["All", ...Array.from(new Set(examples.map((ex) => ex.industryTag)))];

  const filteredExamples =
    activeFilter === "All" ? examples : examples.filter((ex) => ex.industryTag === activeFilter);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <LandingNav isLoggedIn={isLoggedIn} />

      <main className="pt-32 pb-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-4 text-white">
            Made with Trily
          </h1>
          <p className="text-xl text-white/60">
            Explore what&apos;s possible when you design at the speed of thought.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {industries.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveFilter(tag)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeFilter === tag
                  ? "bg-white text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredExamples.map((example) => (
            <ExampleCard key={example.id} example={example} />
          ))}
        </div>

        {filteredExamples.length === 0 && (
          <div className="text-center py-20 text-white/50">
            No examples found for this category.
          </div>
        )}
      </main>
    </div>
  );
}
