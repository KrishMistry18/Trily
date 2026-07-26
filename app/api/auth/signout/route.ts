import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("session");

  return NextResponse.redirect(new URL("/login", req.url));
}
