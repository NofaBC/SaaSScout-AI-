import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prospectInputSchema, productPatchSchema } from "../lib/validation";

const base = {
  name: "Example Co",
  website: "https://example.com",
  industry: "Software",
  location: "Reston, VA",
  claimType: "company_fit" as const,
  sourceUrl: "https://example.com/about",
  excerpt: "A public company profile with enough detail to pass validation.",
  summary: "The company operates a B2B software product.",
};

describe("input validation", () => {
  it("accepts a valid prospect", () => {
    assert.equal(prospectInputSchema.safeParse(base).success, true);
  });

  it("rejects non-HTTP URLs", () => {
    assert.equal(
      prospectInputSchema.safeParse({ ...base, website: "javascript:alert(1)" }).success,
      false,
    );
  });

  it("rejects an invalid contact email", () => {
    assert.equal(
      prospectInputSchema.safeParse({ ...base, contactEmail: "not-an-email" }).success,
      false,
    );
  });

  it("requires an evidence excerpt with substance", () => {
    assert.equal(
      prospectInputSchema.safeParse({ ...base, excerpt: "short" }).success,
      false,
    );
  });

  it("rejects an unknown product status", () => {
    assert.equal(productPatchSchema.safeParse({ status: "published" }).success, false);
  });
});
