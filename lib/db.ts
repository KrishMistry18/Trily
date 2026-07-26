/**
 * lib/db.ts
 *
 * Edge-safe singleton Firebase Admin client.
 *
 * In development, reuses a single App instance across hot-module
 * reloads to avoid exhausting resources.
 */
import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Extend the global namespace to cache the app in development.
declare global {
  // eslint-disable-next-line no-var
  var __firebase_admin: App | undefined;
}

function createFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Handle escaped newline characters in private key
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// In production, always use a fresh instance/check existing apps.
// In development/test, reuse the cached global instance to prevent
// multiple initializations during hot reloads.
export const firebaseAdminApp: App =
  process.env.NODE_ENV === "production"
    ? createFirebaseAdminApp()
    : (globalThis.__firebase_admin ?? (globalThis.__firebase_admin = createFirebaseAdminApp()));

export const db = getFirestore(firebaseAdminApp);
