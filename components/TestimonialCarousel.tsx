"use client";

import React, { useEffect, useRef, useState } from "react";

import Image from "next/image";

import { TESTIMONIALS_PLACEHOLDER } from "@/config/testimonials";

import { GlassCard } from "@/components/ui/GlassCard";

export function TestimonialCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Auto-advance logic
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let intervalId: NodeJS.Timeout;

    const startAutoScroll = () => {
      intervalId = setInterval(() => {
        if (!scrollContainer) return;

        const cardWidth = 400; // approximate width of a card + gap
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;

        if (scrollContainer.scrollLeft >= maxScroll - 10) {
          // Snap back to start if at the end
          scrollContainer.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          scrollContainer.scrollBy({ left: cardWidth, behavior: "smooth" });
        }
      }, 4000);
    };

    startAutoScroll();

    // Pause on hover
    const handleMouseEnter = () => clearInterval(intervalId);
    const handleMouseLeave = () => startAutoScroll();

    scrollContainer.addEventListener("mouseenter", handleMouseEnter);
    scrollContainer.addEventListener("mouseleave", handleMouseLeave);
    scrollContainer.addEventListener("touchstart", handleMouseEnter);
    scrollContainer.addEventListener("touchend", handleMouseLeave);

    return () => {
      clearInterval(intervalId);
      scrollContainer.removeEventListener("mouseenter", handleMouseEnter);
      scrollContainer.removeEventListener("mouseleave", handleMouseLeave);
      scrollContainer.removeEventListener("touchstart", handleMouseEnter);
      scrollContainer.removeEventListener("touchend", handleMouseLeave);
    };
  }, []);

  // Drag to scroll logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeaveDrag = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll-fast multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div className="relative w-full overflow-hidden py-10">
      <div
        ref={scrollRef}
        className={`flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar cursor-grab px-6 md:px-20 ${isDragging ? "cursor-grabbing select-none" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveDrag}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {TESTIMONIALS_PLACEHOLDER.map((t) => (
          <div key={t.id} className="min-w-[320px] max-w-[400px] snap-center shrink-0">
            <GlassCard className="h-full p-8 flex flex-col pointer-events-none">
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
              <p className="text-white/80 mb-8 italic flex-1 text-lg">&quot;{t.quote}&quot;</p>

              <div className="flex items-center gap-4 mt-auto">
                <Image
                  src={t.avatar}
                  alt={t.name}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full bg-white/10 p-1"
                />
                <div className="flex-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    {t.name} <span className="text-sm">{t.location}</span>
                  </div>
                  <div className="text-sm text-white/50">{t.role}</div>
                </div>
              </div>
            </GlassCard>
          </div>
        ))}
      </div>

      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent pointer-events-none hidden md:block"></div>
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none hidden md:block"></div>
    </div>
  );
}
