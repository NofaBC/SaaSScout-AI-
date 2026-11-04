import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { mailMode } from "@/lib/config";
import { getGmailStatus } from "@/lib/gmail";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/http";
import { getMailer } from "@/lib/mailer";
import { sendApprovedDraft } from "@/lib/send-service";
import { getStore } from "@/lib/store";
import { parseWithSchema, sendSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const owner = await requireOwner();
    const store = await getStore();
    const limit = await store.consumeRateLimit(`send:${owner.email}`, 5, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new HttpError(429, "Pilot send limit reached. Try again tomorrow.", "RATE_LIMITED");
    }

    const { id } = await context.params;
    const body = await request.json();
    const { recipient } = parseWithSchema(sendSchema, body);

    if (mailMode() === "gmail") {
      const gmail = await getGmailStatus();
      if (!gmail.configured) {
        throw new HttpError(503, gmail.setupMessage ?? "Gmail is not configured.", "GMAIL_NOT_CONFIGURED");
      }
      if (!gmail.connected || !gmail.email) {
        throw new HttpError(409, "Gmail is not connected. Connect the owner account first.", "GMAIL_NOT_CONNECTED");
      }
      if (gmail.sendMode === "test" && (!gmail.testRecipient || recipient.toLowerCase() !== gmail.testRecipient.toLowerCase())) {
        throw new HttpError(
          403,
          gmail.testRecipient
            ? `Test mode only allows ${gmail.testRecipient}.`
            : "GMAIL_TEST_RECIPIENT is not configured. No email was sent.",
          "GMAIL_TEST_MODE",
        );
      }
    }

    const record = await sendApprovedDraft(store, id, recipient, getMailer());

    if (record.status === "uncertain") {
      return NextResponse.json(
        { send: record, warning: "Send result is uncertain. Check Gmail Sent; do not resend." },
        { status: 202 },
      );
    }
    if (record.status === "failed") {
      return NextResponse.json(
        { send: record, error: "Send failed. No message was confirmed as accepted." },
        { status: 502 },
      );
    }
    return NextResponse.json({
      send: record,
      message:
        record.provider === "mock"
          ? "Mock send recorded. No email was transmitted."
          : "Gmail accepted the message. Delivery is not confirmed.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
