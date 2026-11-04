import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRawMessage, GMAIL_SCOPES, verifyOAuthState } from "../lib/gmail";

describe("Gmail OAuth and MIME helpers", () => {
  it("requests send-only Gmail permission", () => {
    assert.ok(GMAIL_SCOPES.includes("https://www.googleapis.com/auth/gmail.send"));
    assert.ok(!GMAIL_SCOPES.includes("https://www.googleapis.com/auth/gmail.readonly"));
    assert.ok(!GMAIL_SCOPES.includes("https://www.googleapis.com/auth/gmail.modify"));
  });

  it("verifies OAuth state with exact matching", () => {
    assert.equal(verifyOAuthState("same-state", "same-state"), true);
    assert.equal(verifyOAuthState("state-a", "state-b"), false);
    assert.equal(verifyOAuthState(null, "state"), false);
  });

  it("builds a plain-text MIME message with sender, recipient, and subject", () => {
    const raw = buildRawMessage({
      from: "nofabusinessconsulting@gmail.com",
      to: "test@example.com",
      subject: "A possible fit for Example Co",
      body: "Hello Example Co team,",
    });
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    assert.match(decoded, /From: nofabusinessconsulting@gmail.com/);
    assert.match(decoded, /To: test@example.com/);
    assert.match(decoded, /Subject: A possible fit for Example Co/);
    assert.match(decoded, /Hello Example Co team,/);
  });
});
