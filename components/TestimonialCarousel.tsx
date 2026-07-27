"use client";

import React from "react";
import Image from "next/image";
import { TESTIMONIALS_PLACEHOLDER } from "@/config/testimonials";
import { GlassCard } from "@/components/ui/GlassCard";

// Create two rows of testimonials to scroll in opposite directions
const extendedTestimonials = [...TESTIMONIALS_PLACEHOLDER, ...TESTIMONIALS_PLACEHOLDER];
const mid = Math.ceil(extendedTestimonials.length / 2);
const row1 = extendedTestimonials.slice(0, mid);
const row2 = extendedTestimonials.slice(mid);

const TestimonialCard = ({ t }: { t: any }) => (
  <div className="w-[350px] md:w-[450px] shrink-0 p-4">
    <GlassCard className="h-full p-8 flex flex-col pointer-events-auto transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:border-white/20">
      <div className="flex text-amber-400 mb-6 gap-1">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            className="w-5 h-5 drop-shadow-sm"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <p className="text-white/80 mb-8 italic flex-1 text-lg leading-relaxed">&quot;{t.quote}&quot;</p>

      <div className="flex items-center gap-4 mt-auto">
        <Image
          src={t.avatar}
          alt={t.name}
          width={56}
          height={56}
          className="w-14 h-14 rounded-full bg-white/10 p-1 object-cover"
        />
        <div className="flex-1">
          <div className="font-bold text-white flex items-center gap-2 text-lg">
            {t.name} <span className="text-sm">{t.location}</span>
          </div>
          <div className="text-sm text-white/50">{t.role}</div>
        </div>
      </div>
    </GlassCard>
  </div>
);

export function TestimonialCarousel() {
  return (
    <div className="relative w-full overflow-hidden py-10 group bg-background">
      {/* Reduced motion fallback: basic grid */}
      <div className="hidden motion-reduce:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-6 max-w-7xl mx-auto">
        {TESTIMONIALS_PLACEHOLDER.map((t, idx) => (
          <TestimonialCard key={`static-${idx}`} t={t} />
        ))}
      </div>

      {/* Marquee Container (hidden on reduced motion) */}
      <div className="flex flex-col gap-6 motion-reduce:hidden">
        {/* Row 1 (Left to Right) */}
        <div className="flex w-max animate-marquee-right group-hover:[animation-play-state:paused]">
          {/* Duplicate row content twice to create infinite loop */}
          {[...row1, ...row1].map((t, idx) => (
            <TestimonialCard key={`r1-${idx}`} t={t} />
          ))}
        </div>

        {/* Row 2 (Right to Left) */}
        <div className="flex w-max animate-marquee-left group-hover:[animation-play-state:paused]">
          {/* Duplicate row content twice to create infinite loop */}
          {[...row2, ...row2].map((t, idx) => (
            <TestimonialCard key={`r2-${idx}`} t={t} />
          ))}
        </div>
      </div>

      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent pointer-events-none z-10 hidden md:block"></div>
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 hidden md:block"></div>
    </div>
  );
}
