import { NextResponse } from "next/server";
import { mailMode } from "@/lib/config";
import { firebaseAdminConfigured } from "@/lib/firebase/admin";
import { firebaseClientConfigured } from "@/lib/firebase/public-config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    authMode: "firebase",
    firebaseClientConfigured: firebaseClientConfigured(),
    firebaseAdminConfigured: firebaseAdminConfigured(),
    mailMode: mailMode(),
    storeDriver: "firestore",
    exaConfigured: Boolean(process.env.EXA_API_KEY),
    gmailOAuthConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI &&
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
    ),
    gmailSendMode: process.env.GMAIL_SEND_MODE === "live" ? "live" : "test",
    realDiscoveryConfigured: Boolean(process.env.EXA_API_KEY),
    realGmailConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI &&
        process.env.OAUTH_TOKEN_ENCRYPTION_KEY,
    ),
    realAiConfigured: false,
  });
}
