import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID ?? "saasscout-ai-pilot";
const ownerEmail = (process.env.OWNER_EMAIL ?? "nofabusinessconsulting@gmail.com").toLowerCase();
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let credential;
if (raw) {
  credential = cert(JSON.parse(raw));
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  credential = applicationDefault();
} else {
  console.error("Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.");
  process.exit(1);
}

initializeApp({ credential, projectId });
const db = getFirestore();
const now = new Date().toISOString();
const workspaceRef = db.doc("workspaces/nofa");

await workspaceRef.set(
  {
    id: "nofa",
    name: "NOFA Business Consulting",
    ownerEmail,
    createdAt: now,
  },
  { merge: true },
);

const products = [
  {
    id: "judyhotel",
    name: "JudyHotel™",
    description: "Help hotels answer repetitive guest questions and route service requests.",
  },
  {
    id: "commanddesk",
    name: "CommandDesk AI™",
    description: "Help SaaS teams classify support emails and route inquiries to the right team.",
  },
  {
    id: "judybid",
    name: "JudyBid™",
    description:
      "Help businesses discover and evaluate relevant government contracting opportunities.",
  },
];

for (const product of products) {
  const ref = db.doc(`workspaces/nofa/products/${product.id}`);
  const existing = await ref.get();
  if (existing.exists) continue;
  await ref.set({
    ...product,
    workspaceId: "nofa",
    capabilities: [],
    intendedCustomers: "",
    limitations: "",
    showroomUrl: "https://nofaaifactory.com",
    productUrl: null,
    imageUrl: null,
    status: "draft",
    sourceUrl: null,
    verifiedAt: null,
    verifiedBy: null,
    createdAt: now,
    updatedAt: now,
  });
}

const period = now.slice(0, 7);
await db.doc(`workspaces/nofa/usage/${period}`).set(
  {
    period,
    exaSearches: 0,
    aiEvaluations: 0,
    emailsSent: 0,
    estimatedCostUsd: 0,
  },
  { merge: true },
);

console.log(`Seeded workspace nofa for ${ownerEmail}. Products are draft and unverified.`);
