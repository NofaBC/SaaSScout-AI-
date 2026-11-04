import { randomUUID } from "node:crypto";
import { mailMode } from "./config";
import { HttpError } from "./errors";
import {
  gmailOAuthConfigured,
  getGmailStatus,
  sendGmailMessage,
} from "./gmail";

export interface MailInput {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export interface MailResult {
  providerMessageId: string;
  acceptedAt: string;
  provider: "mock" | "gmail";
}

export interface Mailer {
  readonly provider: "mock" | "gmail";
  status(): Promise<{
    connected: boolean;
    email: string | null;
    mode: "mock" | "gmail";
    scopes: string[];
  }>;
  send(input: MailInput): Promise<MailResult>;
}

export class MockMailer implements Mailer {
  readonly provider = "mock" as const;

  async status() {
    return {
      connected: false,
      email: null,
      mode: "mock" as const,
      scopes: [] as string[],
    };
  }

  async send(input: MailInput): Promise<MailResult> {
    if (!input.to || !input.subject || !input.body) {
      throw new Error("Mock mail requires recipient, subject, and body.");
    }
    return {
      providerMessageId: `mock_${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
      provider: "mock",
    };
  }
}

export class GmailMailer implements Mailer {
  readonly provider = "gmail" as const;

  async status() {
    const status = await getGmailStatus();
    return {
      connected: status.connected,
      email: status.email,
      mode: "gmail" as const,
      scopes: status.scopes,
    };
  }

  async send(input: MailInput): Promise<MailResult> {
    return sendGmailMessage({
      to: input.to,
      subject: input.subject,
      body: input.body,
    });
  }
}

export function getMailer(): Mailer {
  if (mailMode() === "gmail") {
    if (!gmailOAuthConfigured()) {
      throw new HttpError(
        503,
        "Gmail is not configured. Set the Google OAuth and token-encryption environment variables.",
        "GMAIL_NOT_CONFIGURED",
      );
    }
    return new GmailMailer();
  }
  return new MockMailer();
}
