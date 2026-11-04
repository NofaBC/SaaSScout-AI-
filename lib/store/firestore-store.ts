import { adminDb } from "../firebase/admin";
import { ownerEmail } from "../config";
import { hashIdempotency, newId, normalizeDomain, normalizeEmail } from "../ids";
import type {
  Activity,
  Draft,
  DraftInput,
  Product,
  ProductPatch,
  Prospect,
  ProspectInput,
  RateLimitResult,
  SendRecord,
  Stage,
  StoreSnapshot,
  Usage,
} from "../types";
import { STAGES } from "../types";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type Store,
} from "./base";

const WORKSPACE_ID = "nofa";

function nowIso(): string {
  return new Date().toISOString();
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function asActivity(record: Activity) {
  return record as unknown as Record<string, unknown>;
}

export class FirestoreStore implements Store {
  private db() {
    return adminDb();
  }

  private workspaceDoc() {
    return this.db().doc(`workspaces/${WORKSPACE_ID}`);
  }

  private collection(name: string) {
    return this.db().collection(`workspaces/${WORKSPACE_ID}/${name}`);
  }

  private activityRef() {
    return this.collection("activities").doc(newId("act"));
  }

  private activity(
    actorEmail: string,
    action: string,
    entityType: string,
    entityId: string,
    detail: string,
  ): Activity {
    return {
      id: newId("act"),
      workspaceId: WORKSPACE_ID,
      actorEmail,
      action,
      entityType,
      entityId,
      detail,
      createdAt: nowIso(),
    };
  }

  async getSnapshot(): Promise<StoreSnapshot> {
    const [workspace, products, prospects, drafts, sends, activities, usage] =
      await Promise.all([
        this.workspaceDoc().get(),
        this.collection("products").get(),
        this.collection("prospects").orderBy("createdAt", "desc").limit(100).get(),
        this.collection("drafts").limit(100).get(),
        this.collection("sends").orderBy("createdAt", "desc").limit(100).get(),
        this.collection("activities").orderBy("createdAt", "desc").limit(100).get(),
        this.collection("usage").doc(monthKey()).get(),
      ]);

    if (!workspace.exists) {
      throw new NotFoundError(
        "Firestore workspace is not initialized. Run the seed script after configuring Firebase.",
      );
    }

    return {
      workspace: { id: workspace.id, ...workspace.data() } as StoreSnapshot["workspace"],
      products: products.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product),
      prospects: prospects.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Prospect),
      drafts: drafts.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Draft),
      sends: sends.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SendRecord),
      activities: activities.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Activity),
      usage: (usage.data() as Usage | undefined) ?? {
        period: monthKey(),
        exaSearches: 0,
        aiEvaluations: 0,
        emailsSent: 0,
        estimatedCostUsd: 0,
      },
    };
  }

  async listProspects(): Promise<Prospect[]> {
    const snapshot = await this.collection("prospects").orderBy("createdAt", "desc").limit(100).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Prospect);
  }

  async getProspect(id: string): Promise<Prospect | null> {
    const doc = await this.collection("prospects").doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as Prospect) : null;
  }

  async createProspect(input: ProspectInput): Promise<Prospect> {
    const domain = normalizeDomain(input.website);
    const contactEmail = input.contactEmail ? normalizeEmail(input.contactEmail) : null;
    const createdAt = nowIso();
    const prospectId = newId("prospect");
    const prospectRef = this.collection("prospects").doc(prospectId);
    const domainRef = this.collection("prospectDomains").doc(hashIdempotency(["domain", domain]));
    const emailRef = contactEmail
      ? this.collection("contactEmails").doc(hashIdempotency(["email", contactEmail]))
      : null;

    const prospect: Prospect = {
      id: prospectId,
      workspaceId: WORKSPACE_ID,
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
          confidence:
            input.claimType === "explicit_request"
              ? 80
              : input.claimType === "inferred_need"
                ? 60
                : 50,
        },
      ],
      createdAt,
      updatedAt: createdAt,
    };

    await this.db().runTransaction(async (tx) => {
      const [domainDoc, emailDoc] = await Promise.all([
        tx.get(domainRef),
        emailRef ? tx.get(emailRef) : Promise.resolve(null),
      ]);
      if (domainDoc.exists) throw new ConflictError("A prospect with this domain already exists.");
      if (emailDoc?.exists) throw new ConflictError("A prospect with this contact email already exists.");

      const activity = this.activity(
        ownerEmail(),
        "prospect.created",
        "prospect",
        prospect.id,
        `Added ${prospect.name} with ${input.claimType.replaceAll("_", " ")} evidence.`,
      );

      tx.set(prospectRef, prospect);
      tx.set(domainRef, { prospectId, domain });
      if (contactEmail && emailRef) tx.set(emailRef, { prospectId, email: contactEmail });
      tx.set(this.collection("activities").doc(activity.id), asActivity(activity));
    });

    return prospect;
  }

  async updateProspect(
    id: string,
    patch: { stage?: Stage; notes?: string },
  ): Promise<Prospect> {
    const ref = this.collection("prospects").doc(id);
    return this.db().runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new NotFoundError("Prospect not found.");
      if (patch.stage !== undefined && !STAGES.includes(patch.stage)) {
        throw new ValidationError("Invalid pipeline stage.");
      }
      const update: Record<string, unknown> = { updatedAt: nowIso() };
      if (patch.stage !== undefined) update.stage = patch.stage;
      if (patch.notes !== undefined) update.notes = patch.notes;
      tx.update(ref, update);
      const activity = this.activity(
        ownerEmail(),
        "prospect.updated",
        "prospect",
        id,
        `Updated ${String(doc.data()?.name ?? "prospect")}.`,
      );
      tx.set(this.collection("activities").doc(activity.id), asActivity(activity));
      return { id, ...doc.data(), ...update } as Prospect;
    });
  }

  async listProducts(): Promise<Product[]> {
    const snapshot = await this.collection("products").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Product);
  }

  async getProduct(id: string): Promise<Product | null> {
    const doc = await this.collection("products").doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as Product) : null;
  }

  async updateProduct(id: string, patch: ProductPatch, actorEmail: string): Promise<Product> {
    const ref = this.collection("products").doc(id);
    return this.db().runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new NotFoundError("Product not found.");
      const product = { id: doc.id, ...doc.data() } as Product;

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
      const { id: _id, ...write } = product;
      tx.update(ref, write);
      const activity = this.activity(
        actorEmail,
        patch.status === "verified" ? "product.verified" : "product.updated",
        "product",
        id,
        `Updated catalog entry ${product.name}.`,
      );
      tx.set(this.collection("activities").doc(activity.id), asActivity(activity));
      return product;
    });
  }

  async createDraft(input: DraftInput): Promise<Draft> {
    const [prospectDoc, productDoc] = await Promise.all([
      this.collection("prospects").doc(input.prospectId).get(),
      this.collection("products").doc(input.productId).get(),
    ]);
    if (!prospectDoc.exists) throw new NotFoundError("Prospect not found.");
    if (!productDoc.exists) throw new NotFoundError("Product not found.");
    const product = { id: productDoc.id, ...productDoc.data() } as Product;
    if (product.status !== "verified") {
      throw new ConflictError("Only verified products can be used in live drafts.");
    }

    const draft: Draft = {
      id: newId("draft"),
      workspaceId: WORKSPACE_ID,
      prospectId: input.prospectId,
      productId: input.productId,
      subject: input.subject,
      body: input.body,
      status: "draft",
      version: 1,
      approvedAt: null,
      approvedBy: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    const { id, ...write } = draft;
    await this.collection("drafts").doc(id).set(write);
    return draft;
  }

  async getDraft(id: string): Promise<Draft | null> {
    const doc = await this.collection("drafts").doc(id).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as Draft) : null;
  }

  async approveDraft(id: string, actorEmail: string): Promise<Draft> {
    const ref = this.collection("drafts").doc(id);
    return this.db().runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new NotFoundError("Draft not found.");
      const draft = { id: doc.id, ...doc.data() } as Draft;
      if (draft.status !== "draft") {
        throw new ConflictError("Only an unapproved draft can be approved.");
      }
      draft.status = "approved";
      draft.approvedAt = nowIso();
      draft.approvedBy = actorEmail;
      draft.updatedAt = draft.approvedAt;
      tx.update(ref, {
        status: draft.status,
        approvedAt: draft.approvedAt,
        approvedBy: draft.approvedBy,
        updatedAt: draft.updatedAt,
      });
      const activity = this.activity(
        actorEmail,
        "draft.approved",
        "draft",
        id,
        `Approved draft version ${draft.version}.`,
      );
      tx.set(this.collection("activities").doc(activity.id), asActivity(activity));
      return draft;
    });
  }

  async findSendByIdempotencyKey(key: string): Promise<SendRecord | null> {
    const doc = await this.collection("sends").doc(key).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as SendRecord) : null;
  }

  async createSendAttempt(input: {
    draft: Draft;
    recipient: string;
    idempotencyKey: string;
    provider: "mock" | "gmail";
  }): Promise<SendRecord> {
    const sendRef = this.collection("sends").doc(input.idempotencyKey);
    const draftRef = this.collection("drafts").doc(input.draft.id);
    const recipient = normalizeEmail(input.recipient);
    const cooldownRef = this.collection("recipientCooldowns").doc(
      hashIdempotency(["cooldown", recipient]),
    );

    return this.db().runTransaction(async (tx) => {
      const [sendDoc, cooldownDoc, draftDoc] = await Promise.all([
        tx.get(sendRef),
        tx.get(cooldownRef),
        tx.get(draftRef),
      ]);
      if (sendDoc.exists) {
        throw new ConflictError("A send attempt already exists for this draft version.");
      }
      if (!draftDoc.exists) throw new NotFoundError("Draft not found.");
      if (draftDoc.data()?.status !== "approved") {
        throw new ConflictError("Draft must be approved before sending.");
      }
      const cooldown = cooldownDoc.data() as { expiresAt?: number } | undefined;
      if (cooldown?.expiresAt && cooldown.expiresAt > Date.now()) {
        throw new ConflictError("This recipient already has a recent send. The 24-hour cooldown is active.");
      }

      const record: SendRecord = {
        id: input.idempotencyKey,
        workspaceId: WORKSPACE_ID,
        draftId: input.draft.id,
        draftVersion: input.draft.version,
        prospectId: input.draft.prospectId,
        recipient,
        subject: input.draft.subject,
        status: "sending",
        idempotencyKey: input.idempotencyKey,
        provider: input.provider,
        providerMessageId: null,
        errorCode: null,
        acceptedAt: null,
        createdAt: nowIso(),
      };
      const { id, ...write } = record;
      tx.set(sendRef, write);
      tx.set(cooldownRef, {
        recipient,
        sendId: id,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      return record;
    });
  }

  async completeSend(
    id: string,
    input: { providerMessageId: string; acceptedAt: string },
  ): Promise<SendRecord> {
    const sendRef = this.collection("sends").doc(id);
    return this.db().runTransaction(async (tx) => {
      const sendDoc = await tx.get(sendRef);
      if (!sendDoc.exists) throw new NotFoundError("Send record not found.");
      const record = { id: sendDoc.id, ...sendDoc.data() } as SendRecord;
      const draftRef = this.collection("drafts").doc(record.draftId);
      const prospectRef = this.collection("prospects").doc(record.prospectId);
      const usageRef = this.collection("usage").doc(monthKey());
      const [draftDoc, prospectDoc, usageDoc] = await Promise.all([
        tx.get(draftRef),
        tx.get(prospectRef),
        tx.get(usageRef),
      ]);

      record.status = "sent";
      record.providerMessageId = input.providerMessageId;
      record.acceptedAt = input.acceptedAt;
      tx.update(sendRef, {
        status: "sent",
        providerMessageId: input.providerMessageId,
        acceptedAt: input.acceptedAt,
      });
      if (draftDoc.exists) tx.update(draftRef, { status: "sent", updatedAt: input.acceptedAt });
      if (prospectDoc.exists && prospectDoc.data()?.stage === "Saved") {
        tx.update(prospectRef, { stage: "Contacted", updatedAt: input.acceptedAt });
      }
      const usage = (usageDoc.data() as Usage | undefined) ?? {
        period: monthKey(),
        exaSearches: 0,
        aiEvaluations: 0,
        emailsSent: 0,
        estimatedCostUsd: 0,
      };
      usage.emailsSent += 1;
      tx.set(usageRef, usage, { merge: true });
      const activity = this.activity(
        ownerEmail(),
        "send.accepted",
        "send",
        id,
        `Mail provider accepted the message to ${record.recipient}. Delivery is not confirmed.`,
      );
      tx.set(this.collection("activities").doc(activity.id), asActivity(activity));
      return record;
    });
  }

  async failSend(
    id: string,
    status: "failed" | "uncertain",
    errorCode: string,
  ): Promise<SendRecord> {
    const sendRef = this.collection("sends").doc(id);
    return this.db().runTransaction(async (tx) => {
      const sendDoc = await tx.get(sendRef);
      if (!sendDoc.exists) throw new NotFoundError("Send record not found.");
      const record = { id: sendDoc.id, ...sendDoc.data() } as SendRecord;
      record.status = status;
      record.errorCode = errorCode;
      tx.update(sendRef, { status, errorCode });
      const draftRef = this.collection("drafts").doc(record.draftId);
      const draftDoc = await tx.get(draftRef);
      if (draftDoc.exists) tx.update(draftRef, { status, updatedAt: nowIso() });
      const activity = this.activity(
        ownerEmail(),
        status === "uncertain" ? "send.uncertain" : "send.failed",
        "send",
        id,
        status === "uncertain"
          ? "Send result is uncertain. Automatic retry is blocked."
          : `Send failed: ${errorCode}.`,
      );
      tx.set(this.collection("activities").doc(activity.id), asActivity(activity));
      return record;
    });
  }

  async listSends(): Promise<SendRecord[]> {
    const snapshot = await this.collection("sends").orderBy("createdAt", "desc").limit(100).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as SendRecord);
  }

  async consumeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const ref = this.collection("rateLimits").doc(hashIdempotency(["rate", key]));
    return this.db().runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const now = Date.now();
      const bucket = doc.data() as { count?: number; resetAt?: number } | undefined;
      if (!bucket || !bucket.resetAt || bucket.resetAt <= now) {
        const resetAt = now + windowMs;
        tx.set(ref, { key, count: 1, resetAt });
        return { allowed: true, remaining: limit - 1, resetAt };
      }
      if ((bucket.count ?? 0) >= limit) {
        return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
      }
      const count = (bucket.count ?? 0) + 1;
      tx.update(ref, { count });
      return { allowed: true, remaining: limit - count, resetAt: bucket.resetAt };
    });
  }
}
