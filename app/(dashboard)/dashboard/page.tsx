import { redirect } from "next/navigation";

import { getProjectsAction } from "@/app/actions/dashboard";
import { getOfficialExamples } from "@/app/actions/examples";
import { auth } from "@/auth";

import DashboardClient from "@/components/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  let projects: any[] = [];
  let examples: any[] = [];
  try {
    const [fetchedProjects, fetchedExamples] = await Promise.all([
      getProjectsAction("recent", ""),
      getOfficialExamples(),
    ]);
    projects = fetchedProjects;
    examples = fetchedExamples;
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <DashboardClient initialProjects={projects} officialExamples={examples} />
    </div>
  );
}
