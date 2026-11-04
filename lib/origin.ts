import { appUrl } from "./config";
import { HttpError } from "./errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;

  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigin = new URL(appUrl()).origin;
  if (origin && origin !== requestOrigin && origin !== configuredOrigin) {
    throw new HttpError(403, "Cross-origin mutation rejected.", "ORIGIN_REJECTED");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new HttpError(403, "Cross-site mutation rejected.", "ORIGIN_REJECTED");
  }
}
