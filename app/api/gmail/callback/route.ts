import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeOwnerEmail } from "@/lib/authz";
import { appUrl, ownerEmail } from "@/lib/config";
import {
  exchangeGoogleCode,
  getGoogleEmail,
  saveGmailConnection,
  verifyOAuthState,
} from "@/lib/gmail";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value ?? null;

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/app?gmail=error&reason=${reason}`, appUrl()));

  if (error || !code || !verifyOAuthState(state, expectedState)) {
    return fail("oauth_state");
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const email = await getGoogleEmail(tokens.accessToken);
    if (!authorizeOwnerEmail(email, ownerEmail())) {
      return fail("wrong_account");
    }
    await saveGmailConnection({
      email,
      refreshToken: tokens.refreshToken,
      scopes: tokens.scopes,
    });
    const response = NextResponse.redirect(new URL("/app?gmail=connected", appUrl()));
    response.cookies.set("gmail_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail",
      maxAge: 0,
    });
    return response;
  } catch {
    return fail("oauth_failed");
  }
}
