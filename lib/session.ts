import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "saasscout_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface Session {
  email: string;
  role: "owner";
  iat: number;
  exp: number;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(
  email: string,
  secret: string,
  now = Date.now(),
  ttlMs = SESSION_TTL_MS,
): string {
  const session: Session = {
    email: email.toLowerCase(),
    role: "owner",
    iat: now,
    exp: now + ttlMs,
  };
  const payload = encode(JSON.stringify(session));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  now = Date.now(),
): Session | null {
  if (!token) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  if (!safeEqual(signature, sign(payload, secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (
      parsed.role !== "owner" ||
      typeof parsed.email !== "string" ||
      typeof parsed.iat !== "number" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= now
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function authorizeOwnerEmail(
  email: string | null | undefined,
  expected: string,
): boolean {
  return Boolean(email) && email!.toLowerCase() === expected.toLowerCase();
}

export function verifyOwnerCode(submitted: string, expected: string | null): boolean {
  if (!expected) return false;
  return safeEqual(submitted, expected);
}
