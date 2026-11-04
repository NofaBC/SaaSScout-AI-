export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "nofabusinessconsulting@gmail.com").toLowerCase();
}

export function appMode(): "mock" | "firebase" {
  return process.env.AUTH_MODE === "firebase" ? "firebase" : "mock";
}

export function mailMode(): "mock" | "gmail" {
  return process.env.MAIL_MODE === "gmail" ? "gmail" : "mock";
}

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

export function mockOwnerCode(): string | null {
  if (appMode() !== "mock") return null;
  const code = process.env.MOCK_OWNER_CODE;
  return code && code.length >= 8 ? code : null;
}

export function isMockAuth(): boolean {
  return appMode() === "mock";
}
