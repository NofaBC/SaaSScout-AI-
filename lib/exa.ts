import { HttpError } from "./errors";
import type { ProspectInput } from "./types";

export interface DiscoveryInput {
  industry: string;
  location: string;
  keywords: string;
  buyerRole: string;
  maxResults: number;
}

interface ExaResult {
  title?: string;
  url?: string;
  publishedDate?: string;
  text?: string;
  highlights?: string[];
}

interface ExaResponse {
  results?: ExaResult[];
}

export interface DiscoveryResult {
  prospects: ProspectInput[];
  query: string;
  provider: "exa";
}

function cleanName(result: ExaResult): string {
  const title = (result.title ?? "").split(/[|–—]/)[0]?.trim();
  if (title && title.length >= 2) return title.slice(0, 140);
  try {
    return new URL(result.url ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "Unnamed company";
  }
}

function cleanExcerpt(result: ExaResult): string {
  const highlights = (result.highlights ?? []).join(" ").replace(/\s+/g, " ").trim();
  const text = (result.text ?? "").replace(/\s+/g, " ").trim();
  return (highlights || text).slice(0, 1200);
}

export async function discoverWithExa(
  input: DiscoveryInput,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscoveryResult> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      503,
      "Exa is not configured. Add EXA_API_KEY to the server environment to enable live discovery.",
      "EXA_NOT_CONFIGURED",
    );
  }

  const query = [input.keywords, input.industry, input.location]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");
  if (!query) {
    throw new HttpError(400, "Provide a target industry, location, or keyword.", "INVALID_SEARCH");
  }

  const response = await fetchImpl("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: `${query} company`,
      type: "auto",
      category: "company",
      numResults: Math.min(Math.max(input.maxResults, 1), 10),
      contents: {
        text: { maxCharacters: 2500 },
        highlights: { numSentences: 3 },
      },
    }),
  });

  if (!response.ok) {
    throw new HttpError(
      502,
      `Exa discovery failed with HTTP ${response.status}. No demo results were substituted.`,
      "EXA_PROVIDER_ERROR",
    );
  }

  const payload = (await response.json()) as ExaResponse;
  const prospects: ProspectInput[] = [];

  for (const result of payload.results ?? []) {
    if (!result.url || !result.title) continue;
    let website: string;
    try {
      const parsed = new URL(result.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      website = parsed.origin;
    } catch {
      continue;
    }

    const excerpt = cleanExcerpt(result);
    if (excerpt.length < 20) continue;
    const summary = excerpt.slice(0, 700);

    prospects.push({
      name: cleanName(result),
      website,
      industry: input.industry.trim() || "Not classified",
      location: input.location.trim() || "Not provided",
      employeeCount: null,
      sizeSource: null,
      buyerRole: input.buyerRole.trim() || null,
      notes:
        "Discovered by Exa. Industry and location reflect the search filters; they are not independently verified company facts.",
      claimType: "company_fit",
      sourceUrl: result.url,
      sourceTitle: result.title.slice(0, 200),
      excerpt,
      summary,
    });
  }

  return { prospects, query, provider: "exa" };
}
