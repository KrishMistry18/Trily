import dynamic from "next/dynamic";
import Link from "next/link";

import { getOfficialExamples } from "@/app/actions/examples";
import { auth } from "@/auth";

import { EDIT_COST, FULL_GENERATION_COST, SUBSCRIPTION_TIERS } from "@/lib/billing/config";

import { Button } from "@/components/ui/Button";
import { FadeIn } from "@/components/ui/FadeIn";
import { Skeleton } from "@/components/ui/Skeleton";

const ExampleCard = dynamic(
  () => import("@/components/ExampleCard").then((mod) => mod.ExampleCard),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
  },
);
const HeroParallax = dynamic(
  () => import("@/components/HeroParallax").then((mod) => mod.HeroParallax),
  { ssr: true },
);
const HowItWorksPipeline = dynamic(
  () => import("@/components/HowItWorksPipeline").then((mod) => mod.HowItWorksPipeline),
  {
    ssr: true,
    loading: () => <Skeleton className="h-96 w-full rounded-2xl max-w-4xl mx-auto my-24" />,
  },
);
const LandingNav = dynamic(() => import("@/components/LandingNav").then((mod) => mod.LandingNav), {
  ssr: true,
});
const PricingSection = dynamic(
  () => import("@/components/PricingSection").then((mod) => mod.PricingSection),
  {
    ssr: true,
    loading: () => (
      <div className="py-24 max-w-6xl mx-auto">
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    ),
  },
);
const TestimonialCarousel = dynamic(
  () => import("@/components/TestimonialCarousel").then((mod) => mod.TestimonialCarousel),
  {
    ssr: true,
    loading: () => <Skeleton className="h-48 w-full max-w-4xl mx-auto rounded-2xl" />,
  },
);

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const ctaLink = isLoggedIn ? "/dashboard" : "/login";

  // Fetch top 3 examples for the landing page
  const examples = await getOfficialExamples(3);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <LandingNav isLoggedIn={isLoggedIn} />

      <main>
        {/* Hero Section */}
        <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 overflow-hidden px-6">
          {/* Animated Background Mesh */}
          <div className="absolute top-0 inset-x-0 h-screen -z-10 overflow-hidden">
            <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-500 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob"></div>
            <div className="absolute top-0 -right-4 w-72 h-72 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob [animation-delay:2s]"></div>
            <div className="absolute -bottom-8 left-20 w-72 h-72 bg-violet-500 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-blob [animation-delay:4s]"></div>
          </div>

          <FadeIn direction="up" delay={0.1}>
            <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight font-display leading-[1.1]">
                Design at the speed of thought.
                <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500">
                  Built entirely by AI.
                </span>
              </h1>
              <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
                From a plain English description to a beautiful, live website in seconds. No coding
                required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href={ctaLink} className="w-full sm:w-auto">
                  <Button variant="primary" className="w-full text-lg px-8 py-4">
                    Start Building Free
                  </Button>
                </Link>
                <a href="#how-it-works" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full text-lg px-8 py-4">
                    See How It Works
                  </Button>
                </a>
              </div>
            </div>
          </FadeIn>

          {/* Demo Graphic Parallax */}
          <FadeIn delay={0.2}>
            <HeroParallax />
          </FadeIn>
        </section>

        {/* Featured Examples */}
        <section className="py-24 bg-[#050508] px-6 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <FadeIn direction="up">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-white">
                  Built with Trily
                </h2>
                <p className="mt-4 text-lg text-white/60">
                  See what&apos;s possible when you design at the speed of thought.
                </p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {examples.map((ex, idx) => (
                <FadeIn key={ex.id} delay={idx * 0.1}>
                  <ExampleCard example={ex} />
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={0.3}>
              <div className="mt-12 text-center">
                <Link href="/examples">
                  <Button variant="secondary" className="px-8 py-3 text-sm">
                    Browse All Examples
                  </Button>
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>
        <FadeIn delay={0.1}>
          <HowItWorksPipeline />
        </FadeIn>

        {/* Pricing */}
        <FadeIn direction="up" delay={0.1}>
          <PricingSection isLoggedIn={isLoggedIn} />
        </FadeIn>

        {/* Social Proof */}
        <section
          id="testimonials"
          className="py-24 bg-[#050508] border-t border-white/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-fuchsia-500/10 rounded-full mix-blend-screen filter blur-[120px] -z-10 pointer-events-none"></div>

          <FadeIn direction="up" delay={0.1}>
            <div className="max-w-6xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-white">
                  Loved by Creators
                </h2>
                <p className="mt-4 text-lg text-white/60">
                  See what others are building with Trily.
                </p>
              </div>
            </div>

            <div className="w-full">
              <TestimonialCarousel />
            </div>
          </FadeIn>
        </section>

        {/* Bottom CTA */}
        <section className="py-24 px-6 bg-[#050508] text-center border-t border-white/5">
          <FadeIn direction="up">
            <div className="max-w-3xl mx-auto space-y-8">
              <h2 className="text-4xl font-bold text-white tracking-tight">
                Ready to build your next site?
              </h2>
              <p className="text-xl text-white/60">
                Join thousands of creators using Trily to bring their ideas to life.
              </p>
              <Link href={ctaLink} className="inline-block">
                <Button variant="primary" className="px-10 py-5 text-lg">
                  Start Building Free
                </Button>
              </Link>
            </div>
          </FadeIn>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 bg-background text-white/60">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center font-bold text-xs">
              T
            </div>
            <span className="font-bold text-lg tracking-tight">Trily</span>
          </div>
          <div className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Trily Inc. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-primary">
              Terms
            </a>
            <a href="#" className="hover:text-primary">
              Privacy
            </a>
            <a href="#" className="hover:text-primary">
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
