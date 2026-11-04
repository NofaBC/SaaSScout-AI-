import { createCipheriv, createDecipheriv, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { authorizeOwnerEmail } from "./authz";
import { appUrl, ownerEmail } from "./config";
import { HttpError } from "./errors";
import { adminDb } from "./firebase/admin";
import type { MailResult } from "./mailer";
import { UncertainSendError } from "./send-errors";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const CONNECTION_DOC = "workspaces/nofa/private/gmail";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  GMAIL_SCOPE,
];

interface GmailConnection {
  email: string;
  refreshToken: string;
  iv: string;
  tag: string;
  scopes: string[];
  connectedAt: string;
  status: "connected" | "disconnected" | "revoked";
}

interface GmailStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  scopes: string[];
  connectedAt: string | null;
  sendMode: "test" | "live";
  testRecipient: string | null;
  setupMessage: string | null;
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function gmailOAuthConfigured(): boolean {
  return Boolean(
    env("GOOGLE_CLIENT_ID") &&
      env("GOOGLE_CLIENT_SECRET") &&
      env("GOOGLE_REDIRECT_URI") &&
      env("OAUTH_TOKEN_ENCRYPTION_KEY"),
  );
}

export function gmailSetupMessage(): string | null {
  if (gmailOAuthConfigured()) return null;
  return "Gmail is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and OAUTH_TOKEN_ENCRYPTION_KEY.";
}

function encryptionKey(): Buffer {
  const raw = env("OAUTH_TOKEN_ENCRYPTION_KEY");
  if (!raw) {
    throw new HttpError(503, "OAUTH_TOKEN_ENCRYPTION_KEY is not configured.", "GMAIL_NOT_CONFIGURED");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new HttpError(
      503,
      "OAUTH_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
      "GMAIL_NOT_CONFIGURED",
    );
  }
  return key;
}

function encrypt(value: string): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(value: GmailConnection): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(value.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.refreshToken, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function createGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID") ?? "",
    redirect_uri: env("GOOGLE_REDIRECT_URI") ?? "",
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export function verifyOAuthState(received: string | null, expected: string | null): boolean {
  if (!received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  scopes: string[];
}> {
  if (!gmailOAuthConfigured()) {
    throw new HttpError(503, gmailSetupMessage() ?? "Gmail is not configured.", "GMAIL_NOT_CONFIGURED");
  }
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID") ?? "",
      client_secret: env("GOOGLE_CLIENT_SECRET") ?? "",
      redirect_uri: env("GOOGLE_REDIRECT_URI") ?? "",
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new HttpError(502, "Google authorization code exchange failed.", "GMAIL_OAUTH_FAILED");
  }
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
  };
  if (!payload.access_token || !payload.refresh_token) {
    throw new HttpError(
      502,
      "Google did not return a refresh token. Reconnect and grant offline access.",
      "GMAIL_OAUTH_FAILED",
    );
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    scopes: (payload.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function getGoogleEmail(accessToken: string): Promise<string> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new HttpError(502, "Could not read the connected Google account.", "GMAIL_OAUTH_FAILED");
  }
  const payload = (await response.json()) as { email?: string };
  if (!payload.email) {
    throw new HttpError(502, "Google did not return an email address.", "GMAIL_OAUTH_FAILED");
  }
  return payload.email;
}

export async function saveGmailConnection(input: {
  email: string;
  refreshToken: string;
  scopes: string[];
}): Promise<void> {
  if (!authorizeOwnerEmail(input.email, ownerEmail())) {
    throw new HttpError(403, "The connected Google account is not the authorized owner.", "FORBIDDEN");
  }
  if (!input.scopes.includes(GMAIL_SCOPE)) {
    throw new HttpError(403, "Gmail send permission was not granted.", "GMAIL_SCOPE_MISSING");
  }
  const encrypted = encrypt(input.refreshToken);
  await adminDb()
    .doc(CONNECTION_DOC)
    .set({
      email: input.email.toLowerCase(),
      refreshToken: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag,
      scopes: input.scopes,
      connectedAt: new Date().toISOString(),
      status: "connected",
    });
}

export async function getGmailStatus(): Promise<GmailStatus> {
  const sendMode = process.env.GMAIL_SEND_MODE === "live" ? "live" : "test";
  if (!gmailOAuthConfigured()) {
    return {
      configured: false,
      connected: false,
      email: null,
      scopes: [],
      connectedAt: null,
      sendMode,
      testRecipient: env("GMAIL_TEST_RECIPIENT"),
      setupMessage: gmailSetupMessage(),
    };
  }

  const doc = await adminDb().doc(CONNECTION_DOC).get();
  if (!doc.exists) {
    return {
      configured: true,
      connected: false,
      email: null,
      scopes: [],
      connectedAt: null,
      sendMode,
      testRecipient: env("GMAIL_TEST_RECIPIENT"),
      setupMessage: "Connect nofabusinessconsulting@gmail.com to enable sending.",
    };
  }
  const connection = doc.data() as GmailConnection;
  return {
    configured: true,
    connected: connection.status === "connected",
    email: connection.email,
    scopes: connection.scopes,
    connectedAt: connection.connectedAt,
    sendMode,
    testRecipient: env("GMAIL_TEST_RECIPIENT"),
    setupMessage:
      connection.status === "connected"
        ? null
        : "The Gmail connection is no longer active. Reconnect the owner account.",
  };
}

async function getAccessToken(): Promise<{ accessToken: string; email: string }> {
  if (!gmailOAuthConfigured()) {
    throw new HttpError(503, gmailSetupMessage() ?? "Gmail is not configured.", "GMAIL_NOT_CONFIGURED");
  }
  const doc = await adminDb().doc(CONNECTION_DOC).get();
  if (!doc.exists) {
    throw new HttpError(409, "Gmail is not connected. Connect the owner account first.", "GMAIL_NOT_CONNECTED");
  }
  const connection = doc.data() as GmailConnection;
  if (connection.status !== "connected") {
    throw new HttpError(409, "The Gmail connection is inactive. Reconnect the owner account.", "GMAIL_NOT_CONNECTED");
  }

  let refreshToken: string;
  try {
    refreshToken = decrypt(connection);
  } catch {
    throw new HttpError(500, "The stored Gmail token could not be decrypted.", "GMAIL_TOKEN_INVALID");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID") ?? "",
      client_secret: env("GOOGLE_CLIENT_SECRET") ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    await adminDb().doc(CONNECTION_DOC).set({ status: "revoked" }, { merge: true });
    throw new HttpError(
      401,
      "Google rejected the Gmail connection. Reconnect the owner account.",
      "GMAIL_REAUTH_REQUIRED",
    );
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new HttpError(502, "Google did not return an access token.", "GMAIL_TOKEN_ERROR");
  }
  return { accessToken: payload.access_token, email: connection.email };
}

function encodeHeader(value: string): string {
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildRawMessage(input: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string {
  const messageId = `<${randomUUID()}@nofabusinessconsulting.com>`;
  const message = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body,
  ].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
}

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<MailResult> {
  const status = await getGmailStatus();
  if (!status.connected || !status.email) {
    throw new HttpError(409, "Gmail is not connected. Connect the owner account first.", "GMAIL_NOT_CONNECTED");
  }
  if (!authorizeOwnerEmail(status.email, ownerEmail())) {
    throw new HttpError(403, "The connected Gmail account is not the authorized owner.", "FORBIDDEN");
  }

  if (status.sendMode !== "live") {
    if (!status.testRecipient) {
      throw new HttpError(
        503,
        "GMAIL_SEND_MODE is test, but GMAIL_TEST_RECIPIENT is not configured. No email was sent.",
        "GMAIL_TEST_RECIPIENT_MISSING",
      );
    }
    if (input.to.toLowerCase() !== status.testRecipient.toLowerCase()) {
      throw new HttpError(
        403,
        `Test mode only allows ${status.testRecipient}. Set GMAIL_SEND_MODE=live after the test succeeds.`,
        "GMAIL_TEST_MODE",
      );
    }
  }

  const { accessToken, email } = await getAccessToken();
  let response: Response;
  try {
    response = await fetch(GMAIL_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: buildRawMessage({
          from: email,
          to: input.to,
          subject: input.subject,
          body: input.body,
        }),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new UncertainSendError(
      "The Gmail request timed out or the connection failed after the request may have been accepted.",
    );
  }

  if (response.status >= 500) {
    throw new UncertainSendError("Gmail returned a server error; the send result is uncertain.");
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(
      502,
      `Gmail rejected the message (HTTP ${response.status}): ${detail.slice(0, 300)}`,
      "GMAIL_SEND_FAILED",
    );
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new UncertainSendError("Gmail accepted the request without returning a message ID.");
  }
  return {
    providerMessageId: payload.id,
    acceptedAt: new Date().toISOString(),
    provider: "gmail",
  };
}

export async function disconnectGmail(): Promise<void> {
  const doc = await adminDb().doc(CONNECTION_DOC).get();
  if (doc.exists) {
    const connection = doc.data() as GmailConnection;
    try {
      const token = decrypt(connection);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch {
      // Revocation is best-effort; the local token is deleted regardless.
    }
    await doc.ref.delete();
  }
}

export function gmailCallbackUrl(): string {
  return env("GOOGLE_REDIRECT_URI") ?? `${appUrl()}/api/gmail/callback`;
}
