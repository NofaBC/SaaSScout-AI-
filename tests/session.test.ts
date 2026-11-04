import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authorizeOwnerEmail,
  createSessionToken,
  verifyOwnerCode,
  verifySessionToken,
} from "../lib/session";

const secret = "test-secret-that-is-at-least-thirty-two-characters-long";
const owner = "nofabusinessconsulting@gmail.com";

describe("signed owner session", () => {
  it("accepts a valid owner token", () => {
    const token = createSessionToken(owner, secret);
    const session = verifySessionToken(token, secret);
    assert.equal(session?.email, owner);
    assert.equal(session?.role, "owner");
  });

  it("rejects a tampered token", () => {
    const token = createSessionToken(owner, secret);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(verifySessionToken(tampered, secret), null);
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(owner, secret, Date.now(), 1000);
    assert.equal(verifySessionToken(token, secret, Date.now() + 2000), null);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(owner, secret);
    assert.equal(verifySessionToken(token, `${secret}-different`), null);
  });

  it("authorizes only the configured owner email", () => {
    assert.equal(authorizeOwnerEmail("NOFABUSINESSCONSULTING@gmail.com", owner), true);
    assert.equal(authorizeOwnerEmail("someone@example.com", owner), false);
    assert.equal(authorizeOwnerEmail(null, owner), false);
  });

  it("checks the mock owner code with a constant-time comparison", () => {
    assert.equal(verifyOwnerCode("correct-code", "correct-code"), true);
    assert.equal(verifyOwnerCode("wrong-code", "correct-code"), false);
    assert.equal(verifyOwnerCode("anything", null), false);
  });
});
