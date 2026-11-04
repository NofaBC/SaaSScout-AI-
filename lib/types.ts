export const STAGES = ["Saved", "Contacted", "Demo booked", "Won"] as const;
export type Stage = (typeof STAGES)[number];

export const CLAIM_TYPES = ["explicit_request", "inferred_need", "company_fit"] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const PRODUCT_STATUSES = ["draft", "verified", "retired"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type DraftStatus = "draft" | "approved" | "sent" | "failed" | "uncertain";
export type SendStatus = "sending" | "sent" | "failed" | "uncertain";

export interface Workspace {
  id: string;
  name: string;
  ownerEmail: string;
  createdAt: string;
}

export interface Member {
  uid: string;
  email: string;
  role: "owner" | "admin" | "member";
  createdAt: string;
}

export interface Product {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  capabilities: string[];
  intendedCustomers: string;
  limitations: string;
  showroomUrl: string;
  productUrl: string | null;
  imageUrl: string | null;
  status: ProductStatus;
  sourceUrl: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  retrievedAt: string;
  publishedAt: string | null;
  excerpt: string;
  summary: string;
  claimType: ClaimType;
  confidence: number;
}

export interface Prospect {
  id: string;
  workspaceId: string;
  name: string;
  website: string;
  domain: string;
  industry: string;
  location: string;
  employeeCount: number | null;
  sizeSource: string | null;
  buyerRole: string | null;
  stage: Stage;
  notes: string;
  contactName: string | null;
  contactEmail: string | null;
  contactSource: string | null;
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: string;
  workspaceId: string;
  prospectId: string;
  productId: string;
  subject: string;
  body: string;
  status: DraftStatus;
  version: number;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SendRecord {
  id: string;
  workspaceId: string;
  draftId: string;
  draftVersion: number;
  prospectId: string;
  recipient: string;
  subject: string;
  status: SendStatus;
  idempotencyKey: string;
  provider: "mock" | "gmail";
  providerMessageId: string | null;
  errorCode: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: string;
  createdAt: string;
}

export interface Usage {
  period: string;
  exaSearches: number;
  aiEvaluations: number;
  emailsSent: number;
  estimatedCostUsd: number;
}

export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface StoreData {
  workspace: Workspace;
  products: Product[];
  prospects: Prospect[];
  drafts: Draft[];
  sends: SendRecord[];
  activities: Activity[];
  usage: Usage;
  rateLimits: Record<string, RateLimitBucket>;
}

export interface StoreSnapshot {
  workspace: Workspace;
  products: Product[];
  prospects: Prospect[];
  drafts: Draft[];
  sends: SendRecord[];
  activities: Activity[];
  usage: Usage;
}

export interface ProspectInput {
  name: string;
  website: string;
  industry: string;
  location: string;
  employeeCount?: number | null;
  sizeSource?: string | null;
  buyerRole?: string | null;
  notes?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactSource?: string | null;
  claimType: ClaimType;
  sourceUrl: string;
  sourceTitle?: string;
  excerpt: string;
  summary: string;
}

export interface DraftInput {
  prospectId: string;
  productId: string;
  subject: string;
  body: string;
}

export interface ProductPatch {
  description?: string;
  capabilities?: string[];
  intendedCustomers?: string;
  limitations?: string;
  productUrl?: string | null;
  imageUrl?: string | null;
  status?: ProductStatus;
  sourceUrl?: string | null;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}
