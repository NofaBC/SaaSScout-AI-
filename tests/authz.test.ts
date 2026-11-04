import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeOwnerEmail } from "../lib/authz";

const owner = "nofabusinessconsulting@gmail.com";

describe("owner authorization", () => {
  it("authorizes only the configured owner email", () => {
    assert.equal(authorizeOwnerEmail("NOFABUSINESSCONSULTING@gmail.com", owner), true);
    assert.equal(authorizeOwnerEmail("someone@example.com", owner), false);
    assert.equal(authorizeOwnerEmail(null, owner), false);
    assert.equal(authorizeOwnerEmail("", owner), false);
  });
});
