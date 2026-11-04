import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { assertSameOrigin, errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";
import { draftUpdateSchema, parseWithSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireOwner();
    const { id } = await context.params;
    const patch = parseWithSchema(draftUpdateSchema, await request.json());
    const store = await getStore();
    const draft = await store.updateDraft(id, patch);
    return NextResponse.json({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}
