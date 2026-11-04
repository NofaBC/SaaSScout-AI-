import type { Product, Prospect } from "./types";

export interface MatchResult {
  status: "match" | "no_match";
  productId: string | null;
  confidence: number;
  rationale: string;
  evidenceIds: string[];
  matchedTerms: string[];
  method: "verified_catalog_keyword_match";
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "their",
  "about",
  "into",
  "over",
  "under",
  "business",
  "businesses",
  "company",
  "companies",
  "team",
  "teams",
  "help",
  "helps",
  "using",
  "used",
  "will",
  "can",
  "may",
  "our",
  "you",
  "are",
  "was",
  "were",
]);

function terms(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 4 && !STOP_WORDS.has(term)),
    ),
  );
}

export function matchProspect(prospect: Prospect, products: Product[]): MatchResult {
  const verified = products.filter((product) => product.status === "verified");
  if (verified.length === 0) {
    return {
      status: "no_match",
      productId: null,
      confidence: 0,
      rationale:
        "No verified product is available. Verify at least one product before matching or drafting outreach.",
      evidenceIds: prospect.evidence.map((evidence) => evidence.id),
      matchedTerms: [],
      method: "verified_catalog_keyword_match",
    };
  }

  if (prospect.evidence.length === 0) {
    return {
      status: "no_match",
      productId: null,
      confidence: 0,
      rationale: "No source evidence is attached to this prospect.",
      evidenceIds: [],
      matchedTerms: [],
      method: "verified_catalog_keyword_match",
    };
  }

  const evidenceText = prospect.evidence
    .map((evidence) => `${evidence.summary} ${evidence.excerpt}`)
    .join(" ");
  const prospectTerms = new Set(
    terms(`${prospect.industry} ${prospect.buyerRole ?? ""} ${evidenceText}`),
  );

  const scored = verified
    .map((product) => {
      const productText = [
        product.name,
        product.description,
        ...product.capabilities,
        product.intendedCustomers,
      ].join(" ");
      const productTerms = terms(productText);
      const matchedTerms = productTerms.filter((term) => prospectTerms.has(term));
      const industryMatch = productText
        .toLowerCase()
        .includes(prospect.industry.toLowerCase())
        ? 1
        : 0;
      const confidence = Math.min(
        96,
        28 + matchedTerms.length * 8 + industryMatch * 18,
      );
      return { product, matchedTerms, confidence };
    })
    .sort((a, b) => b.confidence - a.confidence);

  const best = scored[0]!;
  if (best.confidence < 48 || best.matchedTerms.length === 0) {
    return {
      status: "no_match",
      productId: null,
      confidence: best.confidence,
      rationale:
        "The verified catalog does not contain enough evidence overlap to recommend a product. No outreach draft was created.",
      evidenceIds: prospect.evidence.map((evidence) => evidence.id),
      matchedTerms: best.matchedTerms,
      method: "verified_catalog_keyword_match",
    };
  }

  return {
    status: "match",
    productId: best.product.id,
    confidence: best.confidence,
    rationale: `${best.product.name} is the closest verified catalog match for the recorded evidence. Shared terms: ${best.matchedTerms
      .slice(0, 6)
      .join(", ")}. This is a catalog match, not confirmed buying intent.`,
    evidenceIds: prospect.evidence.map((evidence) => evidence.id),
    matchedTerms: best.matchedTerms.slice(0, 6),
    method: "verified_catalog_keyword_match",
  };
}
