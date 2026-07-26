"use server";

import { auth } from "@/auth";
import { randomUUID } from "crypto";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/lib/db";

export async function getProjectsAction(sort: "recent" | "name", query: string = "") {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const snapshot = await db.collection("projects").where("ownerId", "==", session.user.id).get();

  const projects = snapshot.docs.map((doc) => doc.data()).filter((p) => !p.deletedAt);

  let filtered = projects;
  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter((p) => p.name?.toLowerCase().includes(q));
  }

  if (sort === "recent") {
    filtered.sort((a, b) => {
      const aTime = a.updatedAt?.toDate?.()?.getTime() || 0;
      const bTime = b.updatedAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });
  } else if (sort === "name") {
    filtered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  return filtered.map((p) => ({
    ...p,
    createdAt: p.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: p.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  }));
}

export async function renameProjectAction(projectId: string, newName: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectRef = db.collection("projects").doc(projectId);
  const doc = await projectRef.get();
  if (!doc.exists || doc.data()?.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized");
  }

  await projectRef.update({
    name: newName,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
}

export async function deleteProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectRef = db.collection("projects").doc(projectId);
  const doc = await projectRef.get();
  if (!doc.exists || doc.data()?.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized");
  }

  await projectRef.update({
    deletedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { success: true };
}

export async function duplicateProjectAction(projectId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectRef = db.collection("projects").doc(projectId);
  const doc = await projectRef.get();
  if (!doc.exists || doc.data()?.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized");
  }

  const originalProject = doc.data()!;

  const versionRef = db
    .collection("projects")
    .doc(projectId)
    .collection("versions")
    .doc(originalProject.currentVersionId);
  const versionDoc = await versionRef.get();
  const currentCode = versionDoc.exists ? versionDoc.data()?.generatedCode : "";

  const newProjectId = randomUUID();
  const newVersionId = randomUUID();
  const batch = db.batch();

  const newProjectRef = db.collection("projects").doc(newProjectId);
  batch.set(newProjectRef, {
    projectId: newProjectId,
    ownerId: session.user.id,
    name: `${originalProject.name} (Copy)`,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    status: "draft",
    currentVersionId: newVersionId,
    thumbnailUrl: originalProject.thumbnailUrl || "",
  });

  const newVersionRef = newProjectRef.collection("versions").doc(newVersionId);
  batch.set(newVersionRef, {
    versionId: newVersionId,
    projectId: newProjectId,
    prompt: "Duplicated from another project",
    generatedCode: currentCode,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: session.user.id,
    parentVersionId: null,
  });

  await batch.commit();
  return { success: true, projectId: newProjectId };
}

export async function updateProjectThumbnailAction(projectId: string, thumbnailUrl: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const projectRef = db.collection("projects").doc(projectId);
  const doc = await projectRef.get();
  if (!doc.exists || doc.data()?.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized");
  }

  await projectRef.update({
    thumbnailUrl,
  });
  return { success: true };
}
