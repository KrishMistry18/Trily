import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getOfficialExampleBySlug } from "@/app/actions/examples";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const example = await getOfficialExampleBySlug(params.slug);
  return {
    title: example ? `${example.title} | Trily Showcase` : "Example Not Found",
  };
}

export default async function ExampleLivePage({ params }: { params: { slug: string } }) {
  const example = await getOfficialExampleBySlug(params.slug);

  if (!example) {
    notFound();
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-white">
      {/* Top Bar */}
      <div className="h-12 bg-black border-b border-white/10 flex items-center justify-between px-4 shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/examples"
            className="text-white/60 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Gallery
          </Link>
          <div className="h-4 w-[1px] bg-white/20"></div>
          <span className="text-white/90 font-medium text-sm">{example.title}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-white/40 text-xs hidden sm:inline-block">Built with</span>
          <Link
            href={`/dashboard?prompt=${encodeURIComponent(example.prompt)}`}
            className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400 hover:opacity-80"
          >
            Trily
          </Link>
        </div>
      </div>

      {/* Full-bleed iframe */}
      <iframe
        srcDoc={example.generatedCode}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
