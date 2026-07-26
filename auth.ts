import { cookies } from "next/headers";

import { getAuth } from "firebase-admin/auth";

import { firebaseAdminApp } from "@/lib/db";

export async function auth() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return null;
    }

    const decoded = await getAuth(firebaseAdminApp).verifySessionCookie(sessionCookie, true);

    return {
      user: {
        id: decoded.uid,
        email: decoded.email,
        name: decoded.name,
      },
    };
  } catch (error) {
    return null;
  }
}
