"use client";

import React from "react";

import { Variants, motion, useReducedMotion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    title: "Describe",
    desc: "Type what you want in plain English.",
    icon: (
      <svg
        className="w-5 h-5 text-indigo-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
        />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Generate",
    desc: "AI writes the code in seconds.",
    icon: (
      <svg
        className="w-5 h-5 text-violet-400"
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
    ),
  },
  {
    num: "03",
    title: "Preview & Edit",
    desc: "Chat to make visual tweaks instantly.",
    icon: (
      <svg
        className="w-5 h-5 text-fuchsia-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Publish",
    desc: "Go live on a custom domain.",
    icon: (
      <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
    ),
  },
];

export function HowItWorksPipeline() {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: shouldReduceMotion ? 1 : 0,
      y: shouldReduceMotion ? 0 : 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  return (
    <div className="py-24 bg-[#050508] relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[300px] bg-indigo-500/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-white">
            How it Works
          </h2>
          <p className="mt-4 text-lg text-white/60">
            From idea to live website in four simple steps.
          </p>
        </div>

        <motion.div
          className="relative"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Horizontal connecting line (Desktop only) */}
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-indigo-500/0 via-violet-500/50 to-fuchsia-500/0"></div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-6">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.num}
                variants={itemVariants}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Number background */}
                <div className="absolute -top-10 font-display text-8xl font-black text-white/5 select-none -z-10 group-hover:text-white/10 transition-colors duration-500">
                  {step.num}
                </div>

                {/* Icon bubble */}
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center mb-6 shadow-xl relative">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
                  {step.icon}
                </div>

                {/* Text */}
                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed px-4">{step.desc}</p>

                {/* Mobile vertical line connector */}
                {index !== STEPS.length - 1 && (
                  <div className="md:hidden w-[1px] h-12 bg-gradient-to-b from-white/10 to-transparent mt-8"></div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
