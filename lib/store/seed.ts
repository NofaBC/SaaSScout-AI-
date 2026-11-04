import { newId } from "../ids";
import type { Product, StoreData } from "../types";

const SHOWROOM = "https://nofaaifactory.com";

function draftProduct(
  workspaceId: string,
  name: string,
  description: string,
  now: string,
): Product {
  return {
    id: newId("prod"),
    workspaceId,
    name,
    description,
    capabilities: [],
    intendedCustomers: "",
    limitations: "",
    showroomUrl: SHOWROOM,
    productUrl: null,
    imageUrl: null,
    status: "draft",
    sourceUrl: null,
    verifiedAt: null,
    verifiedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeedData(ownerEmail: string, now = new Date().toISOString()): StoreData {
  const workspaceId = "nofa";
  return {
    workspace: {
      id: workspaceId,
      name: "NOFA Business Consulting",
      ownerEmail,
      createdAt: now,
    },
    products: [
      draftProduct(
        workspaceId,
        "JudyHotel™",
        "Help hotels answer repetitive guest questions and route service requests.",
        now,
      ),
      draftProduct(
        workspaceId,
        "CommandDesk AI™",
        "Help SaaS teams classify support emails and route inquiries to the right team.",
        now,
      ),
      draftProduct(
        workspaceId,
        "JudyBid™",
        "Help businesses discover and evaluate relevant government contracting opportunities.",
        now,
      ),
    ],
    prospects: [],
    drafts: [],
    sends: [],
    activities: [
      {
        id: newId("act"),
        workspaceId,
        actorEmail: ownerEmail,
        action: "workspace.seeded",
        entityType: "workspace",
        entityId: workspaceId,
        detail: "Pilot workspace created with three draft products pending verification.",
        createdAt: now,
      },
    ],
    usage: {
      period: now.slice(0, 7),
      exaSearches: 0,
      aiEvaluations: 0,
      emailsSent: 0,
      estimatedCostUsd: 0,
    },
    rateLimits: {},
  };
}
