import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { HttpError } from "@/lib/errors";
import { createGoogleAuthUrl, gmailOAuthConfigured, gmailSetupMessage } from "@/lib/gmail";

export async function GET() {
  try {
    await requireOwner();
    if (!gmailOAuthConfigured()) {
      throw new HttpError(503, gmailSetupMessage() ?? "Gmail is not configured.", "GMAIL_NOT_CONFIGURED");
    }
    const state = randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(createGoogleAuthUrl(state));
    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/gmail",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.redirect(new URL(`/app?gmail=error&reason=${error.code}`, appUrl()));
    }
    return NextResponse.redirect(new URL("/app?gmail=error", appUrl()));
  }
}
