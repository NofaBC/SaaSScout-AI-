import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { assertSameOrigin, errorResponse } from "@/lib/http";
import { disconnectGmail } from "@/lib/gmail";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireOwner();
    await disconnectGmail();
    return NextResponse.json({ ok: true, connected: false });
  } catch (error) {
    return errorResponse(error);
  }
}
