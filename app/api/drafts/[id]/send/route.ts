import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/http";
import { getMailer } from "@/lib/mailer";
import { sendApprovedDraft } from "@/lib/send-service";
import { getStore } from "@/lib/store";
import { parseWithSchema, sendSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await requireOwner();
    const store = await getStore();
    const limit = await store.consumeRateLimit(`send:${owner.email}`, 5, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new HttpError(429, "Pilot send limit reached. Try again tomorrow.", "RATE_LIMITED");
    }

    const { id } = await context.params;
    const body = await request.json();
    const { recipient } = parseWithSchema(sendSchema, body);
    const record = await sendApprovedDraft(store, id, recipient, getMailer());

    if (record.status === "uncertain") {
      return NextResponse.json(
        { send: record, warning: "Send result is uncertain. Check Gmail Sent; do not resend." },
        { status: 202 },
      );
    }
    if (record.status === "failed") {
      return NextResponse.json(
        { send: record, error: "Mock send failed. No message was sent." },
        { status: 502 },
      );
    }
    return NextResponse.json({ send: record, message: "Accepted by mock mailer." });
  } catch (error) {
    return errorResponse(error);
  }
}
