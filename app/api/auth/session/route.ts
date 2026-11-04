import { NextResponse } from "next/server";
import { createOwnerSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/http";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "A Firebase ID token is required.", "UNAUTHENTICATED");
    }
    const idToken = authorization.slice("Bearer ".length).trim();
    if (!idToken) throw new HttpError(401, "A Firebase ID token is required.", "UNAUTHENTICATED");

    const { cookie, session } = await createOwnerSession(idToken);

    const memberRef = adminDb().doc(`workspaces/nofa/members/${session.uid}`);
    const member = await memberRef.get();
    if (!member.exists) {
      // The email has already been verified by Firebase and matched to OWNER_EMAIL.
      // The first successful owner sign-in creates the only membership record.
      await memberRef.set({
        uid: session.uid,
        email: session.email,
        role: "owner",
        createdAt: new Date().toISOString(),
      });
    }

    const response = NextResponse.json({ ok: true, email: session.email });
    response.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
