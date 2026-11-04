import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

export class FirebaseNotConfiguredError extends Error {
  readonly status = 503;
  readonly code = "FIREBASE_NOT_CONFIGURED";
}

export function firebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.FIREBASE_PROJECT_ID),
  );
}

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  if (!firebaseAdminConfigured()) {
    throw new FirebaseNotConfiguredError(
      "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID.",
    );
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    let serviceAccount: Record<string, unknown>;
    try {
      serviceAccount = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new FirebaseNotConfiguredError(
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.",
      );
    }
    adminApp = initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      projectId:
        process.env.FIREBASE_PROJECT_ID ??
        (serviceAccount.project_id as string | undefined),
    });
  } else {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return adminApp;
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminDb() {
  return getFirestore(getAdminApp());
}
