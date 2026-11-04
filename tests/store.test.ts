import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { ConflictError } from "../lib/store/base";
import { JsonStore } from "../lib/store/json-store";
import { createSeedData } from "../lib/store/seed";

const tempDirs: string[] = [];

async function openStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "saasscout-store-"));
  tempDirs.push(dir);
  const file = path.join(dir, "store.json");
  return { store: await JsonStore.open(file, "nofabusinessconsulting@gmail.com"), file };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const input = {
  name: "Harborlight Suites",
  website: "https://www.harborlight.example/about",
  industry: "Hospitality",
  location: "Annapolis, MD",
  employeeCount: 42,
  buyerRole: "General Manager",
  contactEmail: "info@harborlight.example",
  contactSource: "https://www.harborlight.example/contact",
  claimType: "explicit_request" as const,
  sourceUrl: "https://www.harborlight.example/news",
  sourceTitle: "Expansion announcement",
  excerpt: "We are looking for a centralized guest messaging tool for our properties.",
  summary: "The company publicly described a need for centralized guest messaging.",
};

describe("persistent prospect store", () => {
  it("seeds the three draft products and no fake prospects", async () => {
    const { store } = await openStore();
    const snapshot = await store.getSnapshot();
    assert.equal(snapshot.products.length, 3);
    assert.equal(snapshot.products.every((product) => product.status === "draft"), true);
    assert.equal(snapshot.prospects.length, 0);
  });

  it("persists prospects, notes, and stages across a reopen", async () => {
    const { store, file } = await openStore();
    const prospect = await store.createProspect(input);
    await store.updateProspect(prospect.id, {
      stage: "Contacted",
      notes: "Owner asked for a follow-up next week.",
    });

    const reopened = await JsonStore.open(file, "nofabusinessconsulting@gmail.com");
    const saved = await reopened.getProspect(prospect.id);
    assert.equal(saved?.stage, "Contacted");
    assert.match(saved?.notes ?? "", /follow-up/);
    assert.equal(saved?.domain, "harborlight.example");
  });

  it("deduplicates a normalized business domain", async () => {
    const { store } = await openStore();
    await store.createProspect(input);
    await assert.rejects(
      store.createProspect({
        ...input,
        name: "Harborlight Suites Duplicate",
        website: "https://harborlight.example/another-page",
        contactEmail: "other@harborlight.example",
      }),
      (error: unknown) => error instanceof ConflictError,
    );
  });

  it("enforces a rate-limit bucket", async () => {
    const { store } = await openStore();
    const first = await store.consumeRateLimit("test", 2, 60_000);
    const second = await store.consumeRateLimit("test", 2, 60_000);
    const third = await store.consumeRateLimit("test", 2, 60_000);
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
  });

  it("keeps all seeded products unverified", () => {
    const data = createSeedData("nofabusinessconsulting@gmail.com");
    assert.deepEqual(
      data.products.map((product) => product.status),
      ["draft", "draft", "draft"],
    );
  });
});
