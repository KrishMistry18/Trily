/**
 * app/(dashboard)/dashboard/page.tsx
 *
 * Dashboard page (server component).
 * Lists the user's projects sorted by last-edited date, or shows an
 * empty-state CTA when no projects exist.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 19.1
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-center"
      data-testid="empty-state"
    >
      {/* Illustration */}
      <svg
        aria-hidden="true"
        className="mb-6 h-24 w-24 text-foreground/20"
        fill="none"
        viewBox="0 0 96 96"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="12"
          y="20"
          width="72"
          height="56"
          rx="8"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
        />
        <path
          d="M32 48 L48 36 L64 48"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="48" cy="36" r="4" fill="currentColor" />
        <path d="M28 60 h40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 68 h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="76" cy="20" r="10" fill="currentColor" className="text-primary" />
        <path d="M76 16 v8 M72 20 h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <h2 className="mb-2 text-xl font-semibold text-foreground">No projects yet</h2>
      <p className="mb-8 max-w-sm text-sm text-foreground/60">
        Describe your website in plain language and let Trily generate it for you in seconds.
      </p>

      {/* CTA */}
      <Link
        href="/dashboard/new"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition"
        data-testid="create-first-site-cta"
      >
        <span aria-hidden="true">+</span>
        Create your first site
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder thumbnail SVG
// ---------------------------------------------------------------------------
function ThumbnailPlaceholder({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
      <span className="text-2xl font-bold text-primary/60" aria-hidden="true">
        {initials}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------
type Project = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  totalCreditsUsed: number;
  updatedAt: Date;
};

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
      aria-label={`Open project: ${project.name}`}
    >
      {/* Thumbnail */}
      <div className="aspect-video w-full overflow-hidden bg-foreground/5">
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnailUrl}
            alt={`${project.name} thumbnail`}
            className="h-full w-full object-cover"
          />
        ) : (
          <ThumbnailPlaceholder name={project.name} />
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-col gap-1 p-4">
        <h3 className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
          {project.name}
        </h3>
        <p className="text-xs text-foreground/50">Edited {formatDate(project.updatedAt)}</p>
        <p className="text-xs text-foreground/40">{project.totalCreditsUsed ?? 0} credits used</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const projectsSnap = await db.collection("projects").where("userId", "==", session.user.id).get();

  const projects = projectsSnap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        thumbnailUrl: data.thumbnailUrl || null,
        totalCreditsUsed: data.totalCreditsUsed || 0,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(0),
      };
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {projects.length === 0
              ? "Get started by creating your first site"
              : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {projects.length > 0 && (
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition"
          >
            <span aria-hidden="true">+</span>
            New site
          </Link>
        )}
      </div>

      {/* Grid or empty state */}
      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Projects grid"
        >
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
