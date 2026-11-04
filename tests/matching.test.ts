import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchProspect } from "../lib/matching";
import type { Product, Prospect } from "../lib/types";

const now = new Date().toISOString();

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    workspaceId: "nofa",
    name: "JudyHotel™",
    description: "Help hotels answer repetitive guest questions and route service requests.",
    capabilities: ["answer guest questions", "route service requests"],
    intendedCustomers: "Hotels and hospitality operations teams",
    limitations: "Requires configuration.",
    showroomUrl: "https://nofaaifactory.com",
    productUrl: null,
    imageUrl: null,
    status: "verified",
    sourceUrl: "https://nofaaifactory.com",
    verifiedAt: now,
    verifiedBy: "owner@example.com",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const prospect: Prospect = {
  id: "prospect1",
  workspaceId: "nofa",
  name: "Harborlight Suites",
  website: "https://harborlight.example",
  domain: "harborlight.example",
  industry: "Hospitality",
  location: "Maryland",
  employeeCount: null,
  sizeSource: null,
  buyerRole: "General Manager",
  stage: "Saved",
  notes: "",
  contactName: null,
  contactEmail: null,
  contactSource: null,
  evidence: [
    {
      id: "evidence1",
      sourceUrl: "https://harborlight.example/news",
      sourceTitle: "Hotel operations update",
      retrievedAt: now,
      publishedAt: null,
      excerpt: "The hotel is evaluating centralized guest messaging and service request routing.",
      summary: "The hotel described guest messaging and service request routing needs.",
      claimType: "inferred_need",
      confidence: 65,
    },
  ],
  createdAt: now,
  updatedAt: now,
};

describe("verified catalog matching", () => {
  it("matches only a verified product with evidence overlap", () => {
    const result = matchProspect(prospect, [product()]);
    assert.equal(result.status, "match");
    assert.equal(result.productId, "p1");
    assert.ok(result.matchedTerms.includes("guest"));
    assert.match(result.rationale, /not confirmed buying intent/i);
  });

  it("returns no match when no product is verified", () => {
    const result = matchProspect(prospect, [product({ status: "draft" })]);
    assert.equal(result.status, "no_match");
    assert.match(result.rationale, /No verified product/i);
  });

  it("returns no match for insufficient evidence overlap", () => {
    const result = matchProspect(
      { ...prospect, industry: "Construction", evidence: [{ ...prospect.evidence[0]!, excerpt: "A general company profile.", summary: "No relevant operational signal." }] },
      [product()],
    );
    assert.equal(result.status, "no_match");
  });
});
