import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return new NextResponse("Missing domain", { status: 400 });
  }

  const snapshot = await db
    .collection("projects")
    .where("customDomain", "==", domain)
    .where("isPublic", "==", true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return new NextResponse(`Domain ${domain} is not configured or not public.`, { status: 404 });
  }

  const data = snapshot.docs[0]?.data();
  const currentVersionId = data?.currentVersionId;
  if (!currentVersionId) {
    return new NextResponse("No versions found.", { status: 404 });
  }

  const versionDoc = await db
    .collection("projects")
    .doc(data.projectId)
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
