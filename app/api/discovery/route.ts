import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { discoverWithExa, type DiscoveryInput } from "@/lib/exa";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/http";
import { ConflictError } from "@/lib/store/base";
import { getStore } from "@/lib/store";
import { discoverySchema, parseWithSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const owner = await requireOwner();
    const store = await getStore();
    const limit = await store.consumeRateLimit(`discovery:${owner.email}`, 5, 24 * 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new HttpError(429, "Discovery limit reached: 5 searches per day.", "RATE_LIMITED");
    }

    const input = parseWithSchema(discoverySchema, await request.json()) as DiscoveryInput;
    const result = await discoverWithExa(input);

    const created = [];
    let skipped = 0;
    for (const prospectInput of result.prospects) {
      try {
        created.push(await store.createProspect(prospectInput));
      } catch (error) {
        if (error instanceof ConflictError) {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }

    return NextResponse.json({
      provider: result.provider,
      query: result.query,
      created,
      skipped,
      count: created.length,
      message:
        created.length === 0
          ? "No supported discoveries were found. No demo results were substituted."
          : undefined,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
