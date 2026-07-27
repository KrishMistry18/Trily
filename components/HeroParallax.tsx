"use client";

import React, { useEffect, useRef, useState } from "react";

const EXAMPLES = [
  {
    prompt: "A matcha shop landing page with earthy tones and a clean hero section...",
    html: `
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
    `,
  },
  {
    prompt: "A dark mode SaaS analytics dashboard with a bento grid layout...",
    html: `
      <html>
        <head>
          <style>
            body { margin: 0; font-family: -apple-system, sans-serif; background: #0f172a; color: white; padding: 60px; box-sizing: border-box; }
            .header { margin-bottom: 40px; display: flex; justify-content: space-between; align-items: center; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
            .card { background: #1e293b; padding: 32px; border-radius: 20px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .card.large { grid-column: span 2; background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%); }
            h2 { margin: 0 0 16px 0; font-size: 1.1rem; font-weight: 500; color: #94a3b8; }
            .val { font-size: 3rem; font-weight: 700; letter-spacing: -0.02em; }
            .trend { color: #10b981; font-size: 1rem; font-weight: 500; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class='header'>
            <h1>Analytics Overview</h1>
            <div style="padding: 10px 20px; background: #3b82f6; border-radius: 8px; font-weight: bold;">Export Report</div>
          </div>
          <div class='grid'>
            <div class='card large'><h2>Revenue</h2><div class='val'>$124,500</div><div class='trend'>↑ 12% vs last month</div></div>
            <div class='card'><h2>Active Users</h2><div class='val'>1,432</div></div>
            <div class='card'><h2>Signups</h2><div class='val'>+84%</div></div>
            <div class='card large'><h2>Conversion</h2><div class='val'>4.2%</div></div>
          </div>
        </body>
      </html>
    `,
  },
  {
    prompt: "A minimalist designer portfolio with serif typography and large whitespace...",
    html: `
      <html>
        <head>
          <style>
            body { margin: 0; font-family: 'Times New Roman', serif; background: #fdfbf7; color: #1a1a1a; display: flex; flex-direction: column; height: 100vh; padding: 40px; box-sizing: border-box;}
            .nav { display: flex; justify-content: space-between; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 2px; }
            .hero { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
            h1 { font-size: 6rem; font-weight: normal; margin: 0 0 24px 0; font-style: italic; }
            p { font-size: 1.2rem; color: #666; max-width: 400px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class='nav'>
            <div>Alex.Studio</div>
            <div>Work / About / Contact</div>
          </div>
          <div class='hero'>
            <h1>Less, but better.</h1>
            <p>I craft digital experiences that focus on typography, space, and essentialism.</p>
          </div>
        </body>
      </html>
    `,
  },
];

export function HeroParallax() {
  const [tilt, setTilt] = useState(0);
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Animation Sequence State
  const [inView, setInView] = useState(true);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [phase, setPhase] = useState<"typing" | "generating" | "preview">("typing");

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setScale(entry.contentRect.width / 1440);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Intersection observer to pause animation when out of view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Tilt on scroll
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

  // Typing Sequence Logic
  useEffect(() => {
    if (!inView) return;

    let timeout: NodeJS.Timeout;
    const currentExample = EXAMPLES[exampleIndex];

    if (phase === "typing") {
      if (typedText.length < currentExample.prompt.length) {
        timeout = setTimeout(
          () => {
            setTypedText(currentExample.prompt.slice(0, typedText.length + 1));
          },
          30 + Math.random() * 40,
        ); // Random typing speed between 30-70ms
      } else {
        timeout = setTimeout(() => setPhase("generating"), 800);
      }
    } else if (phase === "generating") {
      timeout = setTimeout(() => setPhase("preview"), 1000);
    } else if (phase === "preview") {
      timeout = setTimeout(() => {
        setPhase("typing");
        setTypedText("");
        setExampleIndex((i) => (i + 1) % EXAMPLES.length);
      }, 5000); // Keep preview visible for 5s
    }

    return () => clearTimeout(timeout);
  }, [inView, phase, typedText, exampleIndex]);

  return (
    <div className="relative max-w-5xl mx-auto mt-24 px-4 perspective-[2000px]">
      <div
        ref={containerRef}
        className="relative rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden aspect-[16/10] flex flex-col transition-transform duration-75 ease-out z-10"
        style={{
          transform: `rotateX(${tilt}deg) translateY(${tilt * -2}px)`,
          transformStyle: "preserve-3d",
          boxShadow: `0 ${20 + tilt * 2}px ${40 + tilt * 3}px -10px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Safari/macOS Chrome Header */}
        <div className="h-12 border-b border-white/10 flex items-center px-4 gap-2 bg-white/5 relative z-20">
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
            trily.app
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden bg-[#0A0A0A]">
          {/* Phase: Typing / Generating */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-1000 z-20 ${phase === "preview" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          >
            {/* Input Mockup */}
            <div
              className={`w-3/4 max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md transition-all duration-700 ${phase === "generating" ? "scale-95 opacity-50 blur-sm" : "scale-100 opacity-100"}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                  <svg
                    className="w-4 h-4 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-h-[80px]">
                  <p className="text-white/90 text-lg leading-relaxed font-medium">
                    {typedText}
                    {phase === "typing" && (
                      <span className="inline-block w-2 h-5 ml-1 align-middle bg-primary animate-pulse" />
                    )}
                  </p>
                </div>
              </div>

              {phase === "generating" && (
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-center gap-3 text-primary">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-medium animate-pulse">Generating your site...</span>
                </div>
              )}
            </div>
          </div>

          {/* Phase: Preview (Iframe) */}
          <div
            className={`absolute top-0 left-0 w-[1440px] h-[900px] origin-top-left z-10 transition-opacity duration-1000 ${phase === "preview" ? "opacity-100" : "opacity-0"}`}
            style={{ transform: `scale(${scale})` }}
          >
            <iframe
              srcDoc={EXAMPLES[exampleIndex].html}
              className="w-full h-full border-0 bg-transparent"
              sandbox="allow-scripts"
            />
          </div>
        </div>

        {/* Ambient Glow behind the browser */}
        <div className="absolute -inset-20 bg-primary/20 blur-[100px] -z-10 rounded-[3rem] pointer-events-none"></div>
      </div>
    </div>
  );
}
