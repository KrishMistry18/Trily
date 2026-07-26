"use client";

import { Suspense, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { getProjectsAction } from "@/app/actions/dashboard";

import ProjectCard from "./ProjectCard";
import PromptInput from "./PromptInput";
import { GlassCard } from "./ui/GlassCard";
import { Skeleton } from "./ui/Skeleton";

interface DashboardClientProps {
  initialProjects: any[];
  officialExamples?: any[];
}

export default function DashboardClient({
  initialProjects,
  officialExamples = [],
}: DashboardClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>(initialProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name">("recent");
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const updated = await getProjectsAction(sortBy, searchQuery);
      setProjects(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as "recent" | "name";
    setSortBy(val);

    setIsRefreshing(true);
    try {
      const updated = await getProjectsAction(val, searchQuery);
      setProjects(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {projects.length === 0
              ? "Get started by creating your first site"
              : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onBlur={handleRefresh}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </form>

          <select
            value={sortBy}
            onChange={handleSortChange}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-colors [&>option]:bg-[#050508] [&>option]:text-white"
          >
            <option value="recent">Recently Edited</option>
            <option value="name">Name</option>
          </select>

          <Link
            href="/dashboard/new"
            className="tour-new-project shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition"
          >
            <span aria-hidden="true">+</span>
            New site
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center w-full max-w-3xl mx-auto">
          {searchQuery ? (
            <div className="py-24">
              <h2 className="mb-2 text-xl font-semibold text-white">No projects found</h2>
              <p className="text-sm text-white/60">Try a different search term</p>
            </div>
          ) : (
            <div className="w-full text-left">
              <h2 className="text-3xl font-display font-bold tracking-tight text-white mb-2">
                Create your first site
              </h2>
              <p className="text-white/60 mb-8">
                Describe what you want to build, and Trily will generate the code in seconds.
              </p>

              <GlassCard className="p-6 md:p-8 border-white/10 shadow-2xl relative overflow-visible">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-fuchsia-500/20 rounded-full mix-blend-screen filter blur-[50px] pointer-events-none"></div>
                <Suspense fallback={<Skeleton className="w-full h-40 rounded-xl" />}>
                  <PromptInput />
                </Suspense>
              </GlassCard>

              {officialExamples.length > 0 && (
                <div className="mt-8">
                  <p className="text-sm font-medium text-white/40 mb-4 uppercase tracking-wider">
                    Try an example
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {officialExamples.slice(0, 4).map((ex) => (
                      <button
                        key={ex.slug}
                        onClick={() =>
                          router.push(`/dashboard?prompt=${encodeURIComponent(ex.prompt)}`)
                        }
                        className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all shadow-sm flex items-center gap-2 group"
                      >
                        <span className="text-indigo-400 group-hover:text-indigo-300">✧</span>
                        {ex.industry}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 transition-opacity ${isRefreshing ? "opacity-50 pointer-events-none" : ""}`}
        >
          {projects.map((project) => (
            <ProjectCard key={project.projectId} project={project} onRefresh={handleRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}
