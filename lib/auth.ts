import { cookies } from "next/headers";
import { ownerEmail, sessionSecret } from "./config";
import { HttpError } from "./errors";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  authorizeOwnerEmail,
  createSessionToken,
  verifyOwnerCode,
  verifySessionToken,
  type Session,
} from "./session";

export {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  authorizeOwnerEmail,
  createSessionToken,
  verifyOwnerCode,
  verifySessionToken,
  type Session,
};

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value, sessionSecret());
}

export async function requireOwner(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new HttpError(401, "Authentication required.", "UNAUTHENTICATED");
  }
  if (!authorizeOwnerEmail(session.email, ownerEmail())) {
    throw new HttpError(403, "This account is not authorized for the NOFA pilot.", "FORBIDDEN");
  }
  return session;
}
