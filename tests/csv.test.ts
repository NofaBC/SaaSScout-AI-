import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prospectsToCsv, safeCsvCell } from "../lib/csv";
import type { Prospect } from "../lib/types";

describe("CSV export", () => {
  it("neutralizes formula-injection starts", () => {
    assert.match(safeCsvCell('=HYPERLINK("https://evil.example")'), /^"'=HYPERLINK/);
    assert.match(safeCsvCell("\t=cmd"), /^"'\t=cmd/);
    assert.equal(safeCsvCell("normal text"), `"normal text"`);
  });

  it("exports prospect evidence, notes, and stages", () => {
    const now = new Date().toISOString();
    const prospect: Prospect = {
      id: "p1",
      workspaceId: "nofa",
      name: "Example Co",
      website: "https://example.com",
      domain: "example.com",
      industry: "Software",
      location: "Reston, VA",
      employeeCount: 20,
      sizeSource: "manual",
      buyerRole: "Founder",
      stage: "Saved",
      notes: "=danger",
      contactName: "A Person",
      contactEmail: "person@example.com",
      contactSource: "https://example.com/contact",
      evidence: [
        {
          id: "e1",
          sourceUrl: "https://example.com/news",
          sourceTitle: "News",
          retrievedAt: now,
          publishedAt: null,
          excerpt: "We need support routing.",
          summary: "The company described a support routing need.",
          claimType: "explicit_request",
          confidence: 80,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const csv = prospectsToCsv([prospect]);
    assert.match(csv, /Example Co/);
    assert.match(csv, /Explicit request/);
    assert.match(csv, /https:\/\/example\.com\/news/);
    assert.match(csv, /"'=danger/);
    assert.match(csv, /LIVE PILOT/);
  });
});
