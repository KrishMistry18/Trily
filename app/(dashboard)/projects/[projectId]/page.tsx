import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { db } from "@/lib/db";

import ProjectViewClient from "./ProjectViewClient";

interface Props {
  params: {
    projectId: string;
  };
}

export default async function ProjectPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = params;

  // Fetch project to get currentVersionId
  const projectDoc = await db.collection("projects").doc(projectId).get();
  if (!projectDoc.exists) {
    return (
      <div className="p-8 text-center flex flex-col items-center justify-center h-[calc(100vh-4rem)]">
        <h1 className="text-2xl font-bold mb-2">Project not found</h1>
        <p className="text-muted-foreground">The project you&apos;re looking for does not exist.</p>
      </div>
    );
  }

  const project = projectDoc.data();
  // Ensure user owns the project
  if (project?.ownerId !== session.user.id) {
    redirect("/login");
  }

  let initialHtml = null;
  if (project?.currentVersionId) {
    const versionDoc = await db
      .collection("projects")
      .doc(projectId)
      .collection("versions")
      .doc(project.currentVersionId)
      .get();

    initialHtml = versionDoc.data()?.generatedCode ?? null;
  }

  return (
    <ProjectViewClient
      projectId={projectId}
      initialHtml={initialHtml}
      initialActiveVersionId={project?.currentVersionId ?? ""}
    />
  );
}
