import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { projectId: string } }) {
  const doc = await db.collection("projects").doc(params.projectId).get();
  if (!doc.exists) {
    return new NextResponse("Not found", { status: 404 });
  }

  const data = doc.data()!;
  if (!data.isPublic) {
    return new NextResponse("This site is private or does not exist.", { status: 404 });
  }

  const currentVersionId = data.currentVersionId;
  if (!currentVersionId) {
    return new NextResponse("No versions found.", { status: 404 });
  }

  const versionDoc = await db
    .collection("projects")
    .doc(params.projectId)
    .collection("versions")
    .doc(currentVersionId)
    .get();
  const html = versionDoc.data()?.generatedCode || "";

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=59",
    },
  });
}
