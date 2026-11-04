import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { assertSameOrigin, errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseWithSchema, productPatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const owner = await requireOwner();
    const { id } = await context.params;
    const body = await request.json();
    const patch = parseWithSchema(productPatchSchema, body);
    const store = await getStore();
    const product = await store.updateProduct(id, patch, owner.email);
    return NextResponse.json({ product });
  } catch (error) {
    return errorResponse(error);
  }
}
