import { newId, normalizeDomain, normalizeEmail } from "../ids";
import type {
  Draft,
  DraftInput,
  Product,
  ProductPatch,
  Prospect,
  ProspectInput,
  RateLimitResult,
  SendRecord,
  Stage,
  StoreData,
  StoreSnapshot,
  Usage,
} from "../types";
import { STAGES } from "../types";

export class NotFoundError extends Error {
  readonly status = 404;
}

export class ConflictError extends Error {
  readonly status = 409;
}

export class ValidationError extends Error {
  readonly status = 400;
}

export interface Store {
  getSnapshot(): Promise<StoreSnapshot>;
  listProspects(): Promise<Prospect[]>;
  getProspect(id: string): Promise<Prospect | null>;
  createProspect(input: ProspectInput): Promise<Prospect>;
  updateProspect(id: string, patch: { stage?: Stage; notes?: string }): Promise<Prospect>;
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  updateProduct(id: string, patch: ProductPatch, actorEmail: string): Promise<Product>;
  createDraft(input: DraftInput): Promise<Draft>;
  getDraft(id: string): Promise<Draft | null>;
  approveDraft(id: string, actorEmail: string): Promise<Draft>;
  findSendByIdempotencyKey(key: string): Promise<SendRecord | null>;
  createSendAttempt(input: {
    draft: Draft;
    recipient: string;
    idempotencyKey: string;
    provider: "mock" | "gmail";
  }): Promise<SendRecord>;
  completeSend(
    id: string,
    input: { providerMessageId: string; acceptedAt: string },
  ): Promise<SendRecord>;
  failSend(id: string, status: "failed" | "uncertain", errorCode: string): Promise<SendRecord>;
  listSends(): Promise<SendRecord[]>;
  consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export abstract class BaseStore implements Store {
  protected data: StoreData;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(data: StoreData) {
    this.data = structuredClone(data);
  }

  protected abstract persist(): Promise<void>;

  protected enqueue<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private activity(
    actorEmail: string,
    action: string,
    entityType: string,
    entityId: string,
    detail: string,
  ): void {
    this.data.activities.unshift({
      id: newId("act"),
      workspaceId: this.data.workspace.id,
      actorEmail,
      action,
      entityType,
      entityId,
      detail,
      createdAt: nowIso(),
    });
    this.data.activities = this.data.activities.slice(0, 500);
  }

  private usage(): Usage {
    const period = monthKey();
    if (this.data.usage.period !== period) {
      this.data.usage = {
        period,
        exaSearches: 0,
        aiEvaluations: 0,
        emailsSent: 0,
        estimatedCostUsd: 0,
      };
    }
    return this.data.usage;
  }

  async getSnapshot(): Promise<StoreSnapshot> {
    await this.queue;
    const copy = structuredClone(this.data);
    return {
      workspace: copy.workspace,
      products: copy.products,
      prospects: copy.prospects,
      drafts: copy.drafts,
      sends: copy.sends,
      activities: copy.activities,
      usage: copy.usage,
    };
  }

  async listProspects(): Promise<Prospect[]> {
    await this.queue;
    return structuredClone(this.data.prospects);
  }

  async getProspect(id: string): Promise<Prospect | null> {
    await this.queue;
    return structuredClone(this.data.prospects.find((p) => p.id === id) ?? null);
  }

  async createProspect(input: ProspectInput): Promise<Prospect> {
    return this.enqueue(async () => {
      const domain = normalizeDomain(input.website);
      if (this.data.prospects.some((p) => p.domain === domain)) {
        throw new ConflictError("A prospect with this domain already exists.");
      }

      const contactEmail = input.contactEmail ? normalizeEmail(input.contactEmail) : null;
      if (
        contactEmail &&
        this.data.prospects.some((p) => p.contactEmail?.toLowerCase() === contactEmail)
      ) {
        throw new ConflictError("A prospect with this contact email already exists.");
      }

      const createdAt = nowIso();
      const prospect: Prospect = {
        id: newId("prospect"),
        workspaceId: this.data.workspace.id,
        name: input.name.trim(),
        website: input.website,
        domain,
        industry: input.industry.trim(),
        location: input.location.trim(),
        employeeCount: input.employeeCount ?? null,
        sizeSource: input.sizeSource?.trim() || (input.employeeCount ? "manual" : null),
        buyerRole: input.buyerRole?.trim() || null,
        stage: "Saved",
        notes: input.notes?.trim() ?? "",
        contactName: input.contactName?.trim() || null,
        contactEmail,
        contactSource: input.contactSource?.trim() || null,
        evidence: [
          {
            id: newId("ev"),
            sourceUrl: input.sourceUrl,
            sourceTitle: input.sourceTitle?.trim() || "Manually recorded source",
            retrievedAt: createdAt,
            publishedAt: null,
            excerpt: input.excerpt.trim(),
            summary: input.summary.trim(),
            claimType: input.claimType,
            confidence: input.claimType === "explicit_request" ? 80 : input.claimType === "inferred_need" ? 60 : 50,
          },
        ],
        createdAt,
        updatedAt: createdAt,
      };

      this.data.prospects.unshift(prospect);
      this.activity(
        this.data.workspace.ownerEmail,
        "prospect.created",
        "prospect",
        prospect.id,
        `Added ${prospect.name} with ${input.claimType.replaceAll("_", " ")} evidence.`,
      );
      await this.persist();
      return structuredClone(prospect);
    });
  }

  async updateProspect(
    id: string,
    patch: { stage?: Stage; notes?: string },
  ): Promise<Prospect> {
    return this.enqueue(async () => {
      const prospect = this.data.prospects.find((p) => p.id === id);
      if (!prospect) throw new NotFoundError("Prospect not found.");
      if (patch.stage !== undefined) {
        if (!STAGES.includes(patch.stage)) throw new ValidationError("Invalid pipeline stage.");
        prospect.stage = patch.stage;
      }
      if (patch.notes !== undefined) {
        prospect.notes = patch.notes;
      }
      prospect.updatedAt = nowIso();
      this.activity(
        this.data.workspace.ownerEmail,
        "prospect.updated",
        "prospect",
        prospect.id,
        `Updated ${prospect.name}.`,
      );
      await this.persist();
      return structuredClone(prospect);
    });
  }

  async listProducts(): Promise<Product[]> {
    await this.queue;
    return structuredClone(this.data.products);
  }

  async getProduct(id: string): Promise<Product | null> {
    await this.queue;
    return structuredClone(this.data.products.find((p) => p.id === id) ?? null);
  }

  async updateProduct(id: string, patch: ProductPatch, actorEmail: string): Promise<Product> {
    return this.enqueue(async () => {
      const product = this.data.products.find((p) => p.id === id);
      if (!product) throw new NotFoundError("Product not found.");

      if (patch.description !== undefined) product.description = patch.description;
      if (patch.capabilities !== undefined) product.capabilities = patch.capabilities;
      if (patch.intendedCustomers !== undefined) product.intendedCustomers = patch.intendedCustomers;
      if (patch.limitations !== undefined) product.limitations = patch.limitations;
      if (patch.productUrl !== undefined) product.productUrl = patch.productUrl;
      if (patch.imageUrl !== undefined) product.imageUrl = patch.imageUrl;
      if (patch.sourceUrl !== undefined) product.sourceUrl = patch.sourceUrl;

      if (patch.status !== undefined) {
        if (patch.status === "verified") {
          if (
            !product.sourceUrl ||
            product.capabilities.length === 0 ||
            !product.intendedCustomers ||
            !product.limitations
          ) {
            throw new ValidationError(
              "A verified product requires a source URL, capabilities, intended customers, and limitations.",
            );
          }
          product.verifiedAt = nowIso();
          product.verifiedBy = actorEmail;
        } else {
          product.verifiedAt = null;
          product.verifiedBy = null;
        }
        product.status = patch.status;
      }

      product.updatedAt = nowIso();
      this.activity(
        actorEmail,
        patch.status === "verified" ? "product.verified" : "product.updated",
        "product",
        product.id,
        `Updated catalog entry ${product.name}.`,
      );
      await this.persist();
      return structuredClone(product);
    });
  }

  async createDraft(input: DraftInput): Promise<Draft> {
    return this.enqueue(async () => {
      const prospect = this.data.prospects.find((p) => p.id === input.prospectId);
      if (!prospect) throw new NotFoundError("Prospect not found.");
      const product = this.data.products.find((p) => p.id === input.productId);
      if (!product) throw new NotFoundError("Product not found.");
      if (product.status !== "verified") {
        throw new ConflictError("Only verified products can be used in live drafts.");
      }

      const createdAt = nowIso();
      const draft: Draft = {
        id: newId("draft"),
        workspaceId: this.data.workspace.id,
        prospectId: prospect.id,
        productId: product.id,
        subject: input.subject,
        body: input.body,
        status: "draft",
        version: 1,
        approvedAt: null,
        approvedBy: null,
        createdAt,
        updatedAt: createdAt,
      };
      this.data.drafts.unshift(draft);
      this.activity(
        this.data.workspace.ownerEmail,
        "draft.created",
        "draft",
        draft.id,
        `Created a draft for ${prospect.name}.`,
      );
      await this.persist();
      return structuredClone(draft);
    });
  }

  async getDraft(id: string): Promise<Draft | null> {
    await this.queue;
    return structuredClone(this.data.drafts.find((d) => d.id === id) ?? null);
  }

  async approveDraft(id: string, actorEmail: string): Promise<Draft> {
    return this.enqueue(async () => {
      const draft = this.data.drafts.find((d) => d.id === id);
      if (!draft) throw new NotFoundError("Draft not found.");
      if (draft.status !== "draft") {
        throw new ConflictError("Only an unapproved draft can be approved.");
      }
      draft.status = "approved";
      draft.approvedAt = nowIso();
      draft.approvedBy = actorEmail;
      draft.updatedAt = draft.approvedAt;
      this.activity(
        actorEmail,
        "draft.approved",
        "draft",
        draft.id,
        `Approved draft version ${draft.version}.`,
      );
      await this.persist();
      return structuredClone(draft);
    });
  }

  async findSendByIdempotencyKey(key: string): Promise<SendRecord | null> {
    await this.queue;
    return structuredClone(this.data.sends.find((s) => s.idempotencyKey === key) ?? null);
  }

  async createSendAttempt(input: {
    draft: Draft;
    recipient: string;
    idempotencyKey: string;
    provider: "mock" | "gmail";
  }): Promise<SendRecord> {
    return this.enqueue(async () => {
      const draft = this.data.drafts.find((d) => d.id === input.draft.id);
      if (!draft) throw new NotFoundError("Draft not found.");
      if (draft.status !== "approved") {
        throw new ConflictError("Draft must be approved before sending.");
      }
      if (this.data.sends.some((s) => s.idempotencyKey === input.idempotencyKey)) {
        throw new ConflictError("A send attempt already exists for this draft version.");
      }

      const record: SendRecord = {
        id: newId("send"),
        workspaceId: this.data.workspace.id,
        draftId: draft.id,
        draftVersion: draft.version,
        prospectId: draft.prospectId,
        recipient: normalizeEmail(input.recipient),
        subject: draft.subject,
        status: "sending",
        idempotencyKey: input.idempotencyKey,
        provider: input.provider,
        providerMessageId: null,
        errorCode: null,
        acceptedAt: null,
        createdAt: nowIso(),
      };
      this.data.sends.unshift(record);
      await this.persist();
      return structuredClone(record);
    });
  }

  async completeSend(
    id: string,
    input: { providerMessageId: string; acceptedAt: string },
  ): Promise<SendRecord> {
    return this.enqueue(async () => {
      const record = this.data.sends.find((s) => s.id === id);
      if (!record) throw new NotFoundError("Send record not found.");
      record.status = "sent";
      record.providerMessageId = input.providerMessageId;
      record.acceptedAt = input.acceptedAt;
      const draft = this.data.drafts.find((d) => d.id === record.draftId);
      if (draft) {
        draft.status = "sent";
        draft.updatedAt = input.acceptedAt;
      }
      const prospect = this.data.prospects.find((p) => p.id === record.prospectId);
      if (prospect && prospect.stage === "Saved") {
        prospect.stage = "Contacted";
        prospect.updatedAt = input.acceptedAt;
      }
      this.usage().emailsSent += 1;
      this.activity(
        this.data.workspace.ownerEmail,
        "send.accepted",
        "send",
        record.id,
        `Gmail accepted the message to ${record.recipient}. Delivery is not confirmed.`,
      );
      await this.persist();
      return structuredClone(record);
    });
  }

  async failSend(
    id: string,
    status: "failed" | "uncertain",
    errorCode: string,
  ): Promise<SendRecord> {
    return this.enqueue(async () => {
      const record = this.data.sends.find((s) => s.id === id);
      if (!record) throw new NotFoundError("Send record not found.");
      record.status = status;
      record.errorCode = errorCode;
      const draft = this.data.drafts.find((d) => d.id === record.draftId);
      if (draft) {
        draft.status = status;
        draft.updatedAt = nowIso();
      }
      this.activity(
        this.data.workspace.ownerEmail,
        status === "uncertain" ? "send.uncertain" : "send.failed",
        "send",
        record.id,
        status === "uncertain"
          ? "Send result is uncertain. Automatic retry is blocked."
          : `Send failed: ${errorCode}.`,
      );
      await this.persist();
      return structuredClone(record);
    });
  }

  async listSends(): Promise<SendRecord[]> {
    await this.queue;
    return structuredClone(this.data.sends);
  }

  async consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    return this.enqueue(async () => {
      const now = Date.now();
      const bucket = this.data.rateLimits[key];
      if (!bucket || bucket.resetAt <= now) {
        this.data.rateLimits[key] = { count: 1, resetAt: now + windowMs };
        await this.persist();
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
      }
      if (bucket.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
      }
      bucket.count += 1;
      await this.persist();
      return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
    });
  }
}
