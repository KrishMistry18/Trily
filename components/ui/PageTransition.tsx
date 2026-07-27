"use client";

import { ReactNode } from "react";

import { usePathname } from "next/navigation";

import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <LazyMotion features={domAnimation} strict>
        <m.div
          key={pathname}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {children}
        </m.div>
      </LazyMotion>
    </AnimatePresence>
  );
}
