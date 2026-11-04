import { randomUUID } from "node:crypto";
import { mailMode } from "./config";

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

export class GmailNotConfiguredError extends Error {
  readonly code = "GMAIL_NOT_CONFIGURED";
}

export function getMailer(): Mailer {
  if (mailMode() === "gmail") {
    throw new GmailNotConfiguredError(
      "Gmail OAuth is not configured in this checkpoint. Set MAIL_MODE=mock or complete Phase 4.",
    );
  }
  return new MockMailer();
}
