import { createHash, randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function normalizeDomain(input: string): string {
  const url = new URL(input);
  return url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function hashIdempotency(parts: Array<string | number>): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
