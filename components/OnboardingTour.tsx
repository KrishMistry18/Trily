"use client";

import { useEffect, useState } from "react";

import dynamic from "next/dynamic";

import { markOnboardingSeenAction } from "@/app/actions/user";

import { TourErrorBoundary } from "./TourErrorBoundary";

// Dynamically import Joyride so it doesn't break SSR
// @ts-ignore
const Joyride = dynamic(() => import("react-joyride").then((mod: any) => mod.default || mod), {
  ssr: false,
}) as any;

export function OnboardingTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Small delay so the UI finishes mounting before the tour starts
    const timer = setTimeout(() => setRun(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const steps = [
    {
      target: "main",
      content: "Welcome to Trily! Let's take a quick tour to help you get started.",
      placement: "center" as const,
      disableBeacon: true,
    },
    {
      target: ".tour-new-project", // We need to add this class to the "Generate new site" box
      content:
        "Here is where you'll create your first AI-generated website. Just type what you want!",
      placement: "bottom" as const,
    },
    {
      target: ".tour-credit-balance", // We need to add this class to the credit balance
      content:
        "You've been given some free credits to start. Generations cost credits, and edits cost a little less.",
      placement: "bottom" as const,
    },
  ];

  const handleJoyrideCallback = async (data: any) => {
    const { status } = data;
    const finishedStatuses = ["finished", "skipped"];
    if (finishedStatuses.includes(status)) {
      setRun(false);
      // Fire and forget server action to update db
      await markOnboardingSeenAction();
    }
  };

  if (!run) return null;

  return (
    <TourErrorBoundary>
      <Joyride
        steps={steps}
        run={run}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        callback={handleJoyrideCallback}
        styles={
          {
            options: {
              primaryColor: "#000",
              zIndex: 10000,
            },
          } as any
        }
      />
    </TourErrorBoundary>
  );
}
