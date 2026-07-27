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
  const [activeIndustryFilter, setActiveIndustryFilter] = useState<string>("All Industries");
  const [activePatternFilter, setActivePatternFilter] = useState<string>("All Patterns");

  const industries = [
    "All Industries",
    ...Array.from(new Set(examples.map((ex) => ex.industryTag).filter(Boolean))),
  ];
  const patterns = [
    "All Patterns",
    ...Array.from(new Set(examples.map((ex) => ex.patternTag).filter(Boolean))),
  ];

  const filteredExamples = examples.filter((ex) => {
    const matchIndustry =
      activeIndustryFilter === "All Industries" || ex.industryTag === activeIndustryFilter;
    const matchPattern =
      activePatternFilter === "All Patterns" || ex.patternTag === activePatternFilter;
    return matchIndustry && matchPattern;
  });

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
        <div className="flex flex-col items-center gap-4 mb-12">
          {/* Industry Filter */}
          <div className="flex flex-wrap justify-center gap-2">
            {industries.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveIndustryFilter(tag)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeIndustryFilter === tag
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Pattern Filter */}
          <div className="flex flex-wrap justify-center gap-2">
            {patterns.map((tag) => (
              <button
                key={tag}
                onClick={() => setActivePatternFilter(tag)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activePatternFilter === tag
                    ? "bg-primary text-black"
                    : "bg-white/5 text-primary/60 hover:bg-white/10 hover:text-primary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
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
