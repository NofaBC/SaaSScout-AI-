import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { prospectsToCsv } from "@/lib/csv";
import { errorResponse, HttpError } from "@/lib/http";
import { getStore } from "@/lib/store";

export async function GET() {
  try {
    const owner = await requireOwner();
    const store = await getStore();
    const limit = await store.consumeRateLimit(`export:${owner.email}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new HttpError(429, "Export limit reached. Try again later.", "RATE_LIMITED");
    }

    const csv = prospectsToCsv(await store.listProspects());
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="saasscout-nofa-prospects-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
