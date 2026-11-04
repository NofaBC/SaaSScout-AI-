import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { HttpError } from "../lib/errors";
import { discoverWithExa } from "../lib/exa";

const originalKey = process.env.EXA_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.EXA_API_KEY;
  else process.env.EXA_API_KEY = originalKey;
});

describe("Exa discovery adapter", () => {
  it("returns a helpful setup error without an API key", async () => {
    delete process.env.EXA_API_KEY;
    await assert.rejects(
      discoverWithExa({
        industry: "Hospitality",
        location: "Maryland",
        keywords: "",
        buyerRole: "",
        maxResults: 10,
      }),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 503 &&
        error.code === "EXA_NOT_CONFIGURED",
    );
  });

  it("maps Exa results to evidence-backed prospects", async () => {
    process.env.EXA_API_KEY = "test-key";
    const fakeFetch = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: "Harborlight Suites | Independent hotel",
              url: "https://www.harborlight.example/about",
              publishedDate: "2026-10-01",
              text: "Harborlight Suites is an independent hotel group.",
              highlights: ["The hotel is evaluating a centralized guest messaging service."],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const result = await discoverWithExa(
      {
        industry: "Hospitality",
        location: "Maryland",
        keywords: "guest messaging",
        buyerRole: "General Manager",
        maxResults: 10,
      },
      fakeFetch as typeof fetch,
    );

    assert.equal(result.provider, "exa");
    assert.equal(result.prospects.length, 1);
    assert.equal(result.prospects[0]?.name, "Harborlight Suites");
    assert.equal(result.prospects[0]?.website, "https://www.harborlight.example");
    assert.equal(result.prospects[0]?.claimType, "company_fit");
    assert.match(result.prospects[0]?.excerpt ?? "", /guest messaging/);
    assert.equal(result.prospects[0]?.sourceUrl, "https://www.harborlight.example/about");
  });
});
