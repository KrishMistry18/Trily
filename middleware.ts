import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: ["/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)"],
};

export default async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host") || "";

  const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const isVercel = hostname.includes("vercel.app");

  if (!isLocalhost && !isVercel) {
    return NextResponse.rewrite(
      new URL(`/api/proxy?domain=${encodeURIComponent(hostname)}`, req.url),
    );
  }

  return NextResponse.next();
}
