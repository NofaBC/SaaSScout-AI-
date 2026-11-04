import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseWithSchema, prospectPatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
    const { id } = await context.params;
    const body = await request.json();
    const patch = parseWithSchema(prospectPatchSchema, body);
    const store = await getStore();
    const prospect = await store.updateProspect(id, patch);
    return NextResponse.json({ prospect });
  } catch (error) {
    return errorResponse(error);
  }
}
