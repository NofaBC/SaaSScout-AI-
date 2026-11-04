import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockMailer, type Mailer, type MailResult } from "../lib/mailer";
import { sendApprovedDraft, UncertainSendError } from "../lib/send-service";
import { ConflictError } from "../lib/store/base";
import { MemoryStore } from "../lib/store/memory-store";
import { createSeedData } from "../lib/store/seed";

const owner = "nofabusinessconsulting@gmail.com";

async function setup() {
  const store = new MemoryStore(createSeedData(owner));
  const products = await store.listProducts();
  const product = await store.updateProduct(
    products[0]!.id,
    {
      status: "verified",
      sourceUrl: "https://nofaaifactory.com",
      capabilities: ["Answer guest questions"],
      intendedCustomers: "Hotels",
      limitations: "Must be configured by the owner.",
    },
    owner,
  );
  const prospect = await store.createProspect({
    name: "Example Co",
    website: "https://example.com",
    industry: "Software",
    location: "Reston, VA",
    claimType: "company_fit",
    sourceUrl: "https://example.com/about",
    excerpt: "A public company profile with enough detail to pass validation.",
    summary: "The company operates a B2B software product.",
  });
  const draft = await store.createDraft({
    prospectId: prospect.id,
    productId: product.id,
    subject: "A possible fit for Example Co",
    body: "Hello Example Co team,\n\nA short introduction.",
  });
  return { store, draft, product, prospect };
}

class FailingMailer implements Mailer {
  readonly provider = "mock" as const;
  async status() {
    return { connected: false, email: null, mode: "mock" as const, scopes: [] };
  }
  async send(): Promise<MailResult> {
    throw new Error("network down");
  }
}

class UncertainMailer implements Mailer {
  readonly provider = "mock" as const;
  async status() {
    return { connected: false, email: null, mode: "mock" as const, scopes: [] };
  }
  async send(): Promise<MailResult> {
    throw new UncertainSendError("timeout after request may have been accepted");
  }
}

describe("mock send boundary", () => {
  it("requires approval before sending", async () => {
    const { store, draft } = await setup();
    await assert.rejects(
      sendApprovedDraft(store, draft.id, "test@example.com", new MockMailer()),
      (error: unknown) => error instanceof ConflictError,
    );
  });

  it("records an accepted send and blocks duplicates", async () => {
    const { store, draft } = await setup();
    await store.approveDraft(draft.id, owner);
    const sent = await sendApprovedDraft(store, draft.id, "test@example.com", new MockMailer());
    assert.equal(sent.status, "sent");
    assert.equal(sent.provider, "mock");
    assert.match(sent.providerMessageId ?? "", /^mock_/);
    assert.equal((await store.getDraft(draft.id))?.status, "sent");

    await assert.rejects(
      sendApprovedDraft(store, draft.id, "test@example.com", new MockMailer()),
      (error: unknown) => error instanceof ConflictError,
    );
  });

  it("enforces a 24-hour per-recipient cooldown across drafts", async () => {
    const { store, draft, product, prospect } = await setup();
    await store.approveDraft(draft.id, owner);
    await sendApprovedDraft(store, draft.id, "test@example.com", new MockMailer());

    const second = await store.createDraft({
      prospectId: prospect.id,
      productId: product.id,
      subject: "A second subject",
      body: "A second body.",
    });
    await store.approveDraft(second.id, owner);
    await assert.rejects(
      sendApprovedDraft(store, second.id, "test@example.com", new MockMailer()),
      (error: unknown) => error instanceof ConflictError,
    );
  });

  it("records a failed attempt without claiming success", async () => {
    const { store, draft } = await setup();
    await store.approveDraft(draft.id, owner);
    const result = await sendApprovedDraft(store, draft.id, "test@example.com", new FailingMailer());
    assert.equal(result.status, "failed");
    assert.equal((await store.getDraft(draft.id))?.status, "failed");
  });

  it("blocks uncertain sends from being retried blindly", async () => {
    const { store, draft } = await setup();
    await store.approveDraft(draft.id, owner);
    const first = await sendApprovedDraft(
      store,
      draft.id,
      "test@example.com",
      new UncertainMailer(),
    );
    assert.equal(first.status, "uncertain");
    await assert.rejects(
      sendApprovedDraft(store, draft.id, "test@example.com", new MockMailer()),
      (error: unknown) => error instanceof ConflictError,
    );
  });
});
