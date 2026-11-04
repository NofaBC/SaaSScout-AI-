import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET() {
  try {
    await requireOwner();
    const store = await getStore();
    return NextResponse.json({ products: await store.listProducts() });
  } catch (error) {
    return errorResponse(error);
  }
}
