import { NextResponse } from "next/server";
import { appMode, mailMode } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    authMode: appMode(),
    mailMode: mailMode(),
    storeDriver: process.env.STORE_DRIVER ?? "json",
    realGmailConfigured: false,
    realDiscoveryConfigured: false,
    realAiConfigured: false,
  });
}
