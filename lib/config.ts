export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "nofabusinessconsulting@gmail.com").toLowerCase();
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function mailMode(): "mock" | "gmail" {
  return process.env.MAIL_MODE === "gmail" ? "gmail" : "mock";
}

export function storeDriver(): "firestore" {
  return "firestore";
}
