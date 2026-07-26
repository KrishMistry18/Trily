"use client";

import React, { useEffect, useState } from "react";

export function HeroParallax() {
  const [tilt, setTilt] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Mount the iframe after a slight delay to prioritize main thread for hero text paint
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const progress = Math.min(scrollY / 600, 1);
          const currentTilt = 20 - progress * 20;
          setTilt(currentTilt);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // init
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative max-w-5xl mx-auto mt-24 px-4 perspective-[2000px]">
      <div
        className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden aspect-video flex flex-col transition-transform duration-75 ease-out"
        style={{
          transform: `rotateX(${tilt}deg) translateY(${tilt * -2}px)`,
          transformStyle: "preserve-3d",
          boxShadow: `0 ${20 + tilt * 2}px ${40 + tilt * 3}px -10px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Safari/macOS Chrome Header */}
        <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-white/5">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-white/10"></div>
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-white/10"></div>
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-white/10"></div>
          <div className="mx-auto px-4 py-1 rounded-md bg-black/20 border border-white/5 text-xs text-white/40 font-mono flex items-center gap-2">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
              />
            </svg>
            https://generated-site.trily.app
          </div>
        </div>

        {/* Iframe Placeholder */}
        <div className="flex-1 relative overflow-hidden bg-white">
          {/* Loading shimmer */}
          <div className="absolute inset-0 bg-slate-100 animate-pulse z-0" />

          {isMounted && (
            <div className="absolute inset-0 w-[150%] h-[150%] origin-top-left scale-[0.666666] z-10">
              <iframe
                srcDoc="
                  <html>
                    <head>
                      <style>
                        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; color: #111; display: flex; flex-direction: column; align-items: center; overflow-x: hidden; }
                        .hero { width: 100%; padding: 120px 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); text-align: center; }
                        h1 { font-size: 3rem; margin-bottom: 1rem; letter-spacing: -0.02em; }
                        p { font-size: 1.25rem; color: #4b5563; max-w: 600px; margin: 0 auto 2rem auto; }
                        .btn { background: #16a34a; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: 500; }
                        .nav { width: 100%; padding: 20px; display: flex; justify-content: space-between; align-items: center; background: white; border-bottom: 1px solid #eee; box-sizing: border-box;}
                        .nav-logo { font-weight: bold; font-size: 1.5rem; }
                      </style>
                    </head>
                    <body>
                      <div class='nav'>
                        <div class='nav-logo'>Matcha Magic</div>
                        <div>Shop</div>
                      </div>
                      <div class='hero'>
                        <h1>Premium Grade Ceremonial Matcha</h1>
                        <p>Sourced directly from Uji, Japan. Elevate your morning ritual.</p>
                        <a href='#' class='btn'>Shop Now</a>
                      </div>
                    </body>
                  </html>
                "
                className="w-full h-full border-0 bg-transparent"
                sandbox="allow-scripts"
              />
            </div>
          )}
        </div>

        {/* Ambient Glow behind the browser */}
        <div className="absolute -inset-20 bg-primary/20 blur-[100px] -z-10 rounded-[3rem] pointer-events-none"></div>
      </div>
    </div>
  );
}
