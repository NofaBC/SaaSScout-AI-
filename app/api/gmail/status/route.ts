import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getGmailStatus } from "@/lib/gmail";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireOwner();
    return NextResponse.json(await getGmailStatus());
  } catch (error) {
    return errorResponse(error);
  }
}
