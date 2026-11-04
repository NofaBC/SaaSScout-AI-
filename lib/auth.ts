import { cookies } from "next/headers";
import { authorizeOwnerEmail } from "./authz";
import { HttpError } from "./errors";
import { adminAuth, firebaseAdminConfigured } from "./firebase/admin";

export { authorizeOwnerEmail };

export const SESSION_COOKIE = "__session";
export const SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;

export interface Session {
  uid: string;
  email: string;
}

export async function getSession(): Promise<Session | null> {
  if (!firebaseAdminConfigured()) {
    throw new HttpError(
      503,
      "Firebase authentication is not configured.",
      "FIREBASE_NOT_CONFIGURED",
    );
  }
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    if (!decoded.email) return null;
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

export async function requireOwner(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new HttpError(401, "Authentication required.", "UNAUTHENTICATED");
  }
  if (!authorizeOwnerEmail(session.email)) {
    throw new HttpError(403, "This account is not authorized for the NOFA pilot.", "FORBIDDEN");
  }
  return session;
}

export async function createOwnerSession(idToken: string): Promise<{
  cookie: string;
  session: Session;
}> {
  if (!firebaseAdminConfigured()) {
    throw new HttpError(
      503,
      "Firebase authentication is not configured.",
      "FIREBASE_NOT_CONFIGURED",
    );
  }
  const decoded = await adminAuth().verifyIdToken(idToken, true);
  if (
    !decoded.email ||
    decoded.email_verified !== true ||
    !authorizeOwnerEmail(decoded.email)
  ) {
    throw new HttpError(403, "This Google account is not authorized for the NOFA pilot.", "FORBIDDEN");
  }

  const cookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
  return { cookie, session: { uid: decoded.uid, email: decoded.email } };
}
