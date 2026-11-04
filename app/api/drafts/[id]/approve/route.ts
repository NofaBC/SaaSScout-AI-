import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { assertSameOrigin, errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const owner = await requireOwner();
    const { id } = await context.params;
    const store = await getStore();
    const draft = await store.approveDraft(id, owner.email);
    return NextResponse.json({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}
