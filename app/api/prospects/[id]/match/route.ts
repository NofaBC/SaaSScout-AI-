import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/http";
import { matchProspect } from "@/lib/matching";
import { buildOutreach } from "@/lib/outreach";
import { getStore } from "@/lib/store";
import { NotFoundError } from "@/lib/store/base";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const owner = await requireOwner();
    const { id } = await context.params;
    const store = await getStore();
    const limit = await store.consumeRateLimit(`match:${owner.email}`, 20, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new HttpError(429, "Draft generation limit reached for today.", "RATE_LIMITED");
    }

    const prospect = await store.getProspect(id);
    if (!prospect) throw new NotFoundError("Prospect not found.");

    const products = await store.listProducts();
    const match = matchProspect(prospect, products);
    if (match.status === "no_match" || !match.productId) {
      return NextResponse.json({ match, draft: null, product: null });
    }

    const product = products.find((entry) => entry.id === match.productId);
    if (!product || product.status !== "verified") {
      return NextResponse.json({
        match: {
          ...match,
          status: "no_match",
          productId: null,
          rationale: "The selected product is no longer verified.",
        },
        draft: null,
        product: null,
      });
    }

    const outreach = buildOutreach(prospect, product);
    const draft = await store.createDraft({
      prospectId: prospect.id,
      productId: product.id,
      subject: outreach.subject,
      body: outreach.body,
    });

    return NextResponse.json({ match, draft, product });
  } catch (error) {
    return errorResponse(error);
  }
}
