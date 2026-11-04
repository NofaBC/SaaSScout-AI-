import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpError } from "../lib/errors";
import { assertSameOrigin } from "../lib/origin";

function request(method: string, origin?: string, site?: string) {
  return new Request("https://saasscout-preview.example/api/prospects", {
    method,
    headers: {
      ...(origin ? { origin } : {}),
      ...(site ? { "sec-fetch-site": site } : {}),
    },
  });
}

describe("origin and CSRF checks", () => {
  it("allows same-origin mutations", () => {
    assert.doesNotThrow(() =>
      assertSameOrigin(request("POST", "https://saasscout-preview.example", "same-origin")),
    );
  });

  it("rejects a cross-origin mutation", () => {
    assert.throws(
      () => assertSameOrigin(request("POST", "https://evil.example", "cross-site")),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
  });

  it("rejects a cross-site browser mutation without a matching origin", () => {
    assert.throws(
      () => assertSameOrigin(request("PATCH", undefined, "cross-site")),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
  });

  it("does not apply CSRF checks to safe methods", () => {
    assert.doesNotThrow(() => assertSameOrigin(request("GET", "https://evil.example", "cross-site")));
  });
});
