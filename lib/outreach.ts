import type { Product, Prospect } from "./types";

export const SHOWROOM_URL = "https://nofaaifactory.com";
export const SENDER_EMAIL = "nofabusinessconsulting@gmail.com";
export const SENDER_SIGNATURE = [
  "Farhad Nasserghodsi",
  "NOFA Business Consulting | NOFA AI Factory™",
  SENDER_EMAIL,
  SHOWROOM_URL,
].join("\n");

export interface OutreachDraftInput {
  subject: string;
  body: string;
}

export function buildOutreach(prospect: Prospect, product: Product): OutreachDraftInput {
  if (product.status !== "verified") {
    throw new Error("Only verified products can be used in outreach.");
  }

  const capabilities = product.capabilities.slice(0, 2).join(" and ");
  const benefit = capabilities
    ? `It is designed to ${capabilities.charAt(0).toLowerCase()}${capabilities.slice(1)}.`
    : product.description;

  const subject = `A possible fit for ${prospect.name}`;
  const body = `Hello ${prospect.name} team,

I'm Farhad Nasserghodsi, founder of NOFA Business Consulting and NOFA AI Factory™. While researching ${prospect.industry} businesses, I came across ${prospect.name}.

I'd like to introduce ${product.name}. ${product.description} ${benefit}

You can explore the NOFA AI Factory showroom here:
${SHOWROOM_URL}

If this looks relevant, reply to this email and I can walk you through how it might fit your workflow. If it is not relevant, just let me know and I won't follow up.

${SENDER_SIGNATURE}`;

  return { subject, body };
}
