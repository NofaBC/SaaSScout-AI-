import { NextResponse } from "next/server";
import { HttpError } from "./errors";
import { ConflictError, NotFoundError, ValidationError } from "./store/base";

export { HttpError };

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof ConflictError) {
    return NextResponse.json(
      { error: error.message, code: "CONFLICT" },
      { status: error.status },
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message, code: "NOT_FOUND" },
      { status: error.status },
    );
  }
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: error.message, code: "INVALID_INPUT" },
      { status: error.status },
    );
  }
  console.error("Unhandled API error", error instanceof Error ? error.message : "unknown");
  return NextResponse.json(
    { error: "An unexpected server error occurred.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function readIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "local";
}
