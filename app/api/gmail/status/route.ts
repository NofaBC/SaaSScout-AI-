import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { mailMode } from "@/lib/config";
import { errorResponse } from "@/lib/http";
import { getMailer } from "@/lib/mailer";

export async function GET() {
  try {
    await requireOwner();
    if (mailMode() === "gmail") {
      return NextResponse.json({
        connected: false,
        email: null,
        mode: "gmail",
        scopes: [],
        message: "Gmail OAuth is not configured in this checkpoint.",
      });
    }
    return NextResponse.json(await getMailer().status());
  } catch (error) {
    return errorResponse(error);
  }
}
