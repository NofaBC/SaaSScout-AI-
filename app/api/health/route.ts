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
    realGmailConfigured: false,
    realDiscoveryConfigured: false,
    realAiConfigured: false,
  });
}
