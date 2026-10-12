import type { NextRequest } from "next/server";

/**
 * What the browser actually addressed. Next.js builds request.url from the
 * address the server listens on — http://0.0.0.0:3000 in the Docker image,
 * http://localhost:3000 behind a reverse proxy — so the Host header (or the
 * X-Forwarded-* headers a proxy sets) tells the real host and scheme.
 */
export function requestHost(request: NextRequest): string {
  return (
    firstValue(request.headers.get("x-forwarded-host")) ||
    request.headers.get("host") ||
    request.nextUrl.host
  );
}

export function isHttps(request: NextRequest): boolean {
  const forwarded = firstValue(request.headers.get("x-forwarded-proto"));
  return forwarded ? forwarded === "https" : request.nextUrl.protocol === "https:";
}

/**
 * Same-site browser requests only, for state-changing calls (on top of
 * SameSite cookies). A cross-site page cannot set the headers compared here;
 * a server-side client sends neither Origin nor Sec-Fetch-Site.
 */
export function isSameSite(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === requestHost(request);
    } catch {
      return false;
    }
  }
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

function firstValue(header: string | null): string {
  return header?.split(",")[0]?.trim() ?? "";
}
