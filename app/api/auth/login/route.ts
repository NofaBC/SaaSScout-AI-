import { NextResponse } from "next/server";
import {
  authorizeOwnerEmail,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  verifyOwnerCode,
} from "@/lib/auth";
import { mockOwnerCode, ownerEmail, sessionSecret } from "@/lib/config";
import { errorResponse, HttpError, readIp } from "@/lib/http";
import { getStore } from "@/lib/store";
import { loginSchema, parseWithSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const store = await getStore();
    const limit = await store.consumeRateLimit(`login:${readIp(request)}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again later.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      );
    }

    const expectedCode = mockOwnerCode();
    if (!expectedCode) {
      throw new HttpError(
        503,
        "Mock owner login is not configured. Set MOCK_OWNER_CODE or configure Firebase Auth.",
        "AUTH_NOT_CONFIGURED",
      );
    }

    const body = await request.json();
    const input = parseWithSchema(loginSchema, body);

    if (
      !authorizeOwnerEmail(input.email, ownerEmail()) ||
      !verifyOwnerCode(input.code, expectedCode)
    ) {
      throw new HttpError(401, "Owner email or access code is incorrect.", "INVALID_CREDENTIALS");
    }

    const token = createSessionToken(ownerEmail(), sessionSecret());
    const response = NextResponse.json({ ok: true, email: ownerEmail() });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
