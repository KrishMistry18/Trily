import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/5 border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ${className}`}
      {...props}
    />
  );
}
