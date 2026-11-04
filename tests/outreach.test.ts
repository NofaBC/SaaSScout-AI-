import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOutreach } from "../lib/outreach";
import type { Product, Prospect } from "../lib/types";

const now = new Date().toISOString();
const product: Product = {
  id: "p1",
  workspaceId: "nofa",
  name: "JudyHotel™",
  description: "Help hotels answer repetitive guest questions and route service requests.",
  capabilities: ["answer guest questions", "route service requests"],
  intendedCustomers: "Hotels",
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
};

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
  buyerRole: null,
  stage: "Saved",
  notes: "",
  contactName: null,
  contactEmail: null,
  contactSource: null,
  evidence: [],
  createdAt: now,
  updatedAt: now,
};

describe("outreach template", () => {
  it("introduces NOFA and one verified product without unsupported claims", () => {
    const draft = buildOutreach(prospect, product);
    assert.match(draft.subject, /Harborlight Suites/);
    assert.match(draft.body, /NOFA Business Consulting/);
    assert.match(draft.body, /NOFA AI Factory/);
    assert.match(draft.body, /JudyHotel™/);
    assert.match(draft.body, /https:\/\/nofaaifactory\.com/);
    assert.match(draft.body, /Farhad Nasserghodsi/);
    assert.match(draft.body, /won't follow up/);
    assert.doesNotMatch(draft.body, /guarantee|save \d|we spoke|reviewed your private/i);
    assert.equal(draft.body.match(/JudyHotel™/g)?.length, 1);
  });

  it("refuses to draft for an unverified product", () => {
    assert.throws(() =>
      buildOutreach(prospect, { ...product, status: "draft" }),
    );
  });
});
