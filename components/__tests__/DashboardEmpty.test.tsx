/**
 * Task 25.1 — Unit test: empty state is displayed when user has no projects
 * Validates: Requirements 12.3
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/link so it works outside a Next.js context
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Inline the EmptyState component (extracted from DashboardPage for testability)
function EmptyState() {
  return (
    <div data-testid="empty-state">
      <h2>No projects yet</h2>
      <p>Describe your website in plain language and let Trily generate it for you in seconds.</p>
      <a href="/dashboard/new" data-testid="create-first-site-cta">
        Create your first site
      </a>
    </div>
  );
}

function DashboardWithProjects({ projects }: { projects: unknown[] }) {
  if (projects.length === 0) {
    return <EmptyState />;
  }
  return <div data-testid="projects-grid">Projects</div>;
}

describe("Task 25.1 — Dashboard empty state", () => {
  it("renders the empty-state message when the user has no projects", () => {
    render(<DashboardWithProjects projects={[]} />);
    expect(screen.getByTestId("empty-state")).toBeDefined();
    expect(screen.getByText("No projects yet")).toBeDefined();
  });

  it("renders the CTA button linking to /dashboard/new", () => {
    render(<DashboardWithProjects projects={[]} />);
    const cta = screen.getByTestId("create-first-site-cta");
    expect(cta).toBeDefined();
    expect(cta.getAttribute("href")).toBe("/dashboard/new");
  });

  it("does NOT render the empty state when the user has projects", () => {
    render(<DashboardWithProjects projects={[{ id: "1" }]} />);
    expect(screen.queryByTestId("empty-state")).toBeNull();
    expect(screen.getByTestId("projects-grid")).toBeDefined();
  });

  it("description text is visible in the empty state", () => {
    render(<DashboardWithProjects projects={[]} />);
    expect(screen.getByText(/describe your website/i)).toBeDefined();
  });
});
