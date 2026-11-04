import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse, HttpError } from "@/lib/http";
import { getStore } from "@/lib/store";
import { parseWithSchema, prospectInputSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireOwner();
    const store = await getStore();
    return NextResponse.json({ prospects: await store.listProspects() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const store = await getStore();
    const limit = await store.consumeRateLimit(`prospect:create:${owner.email}`, 30, 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new HttpError(429, "Prospect creation limit reached. Try again later.", "RATE_LIMITED");
    }

    const body = await request.json();
    const input = parseWithSchema(prospectInputSchema, body);
    const prospect = await store.createProspect(input);
    return NextResponse.json({ prospect }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
