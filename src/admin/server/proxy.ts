import { NextResponse, type NextRequest } from "next/server";

import { readConfig } from "@/server/config";
import { decodeCookie, SESSION_COOKIE } from "./session";

/** Admin pages reachable without a session. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/auth/confirm"];

function isPublicAdminPath(pathname: string) {
  return PUBLIC_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Runs before every /admin request (navigations and link prefetches):
 * redirects visitors without a valid session cookie to the login page.
 *
 * This is an optimistic check: the cookie's signature and expiry are verified
 * without touching the database, which keeps navigation fast. The panel layout
 * and every API call confirm the session row and the administrator profile,
 * and row-level security enforces access on every query. The API answers 401
 * on its own, so it is not redirected here.
 */
export function updateAdminSession(request: NextRequest): NextResponse {
  const config = readConfig();
  const { pathname, search } = request.nextUrl;
  const response = NextResponse.next({ request });

  if (config && !pathname.startsWith("/admin/api/")) {
    const signedIn = Boolean(
      decodeCookie(request.cookies.get(SESSION_COOKIE)?.value, config.sessionSecret),
    );
    if (!signedIn && !isPublicAdminPath(pathname)) {
      const login = new URL("/admin/login", request.url);
      if (pathname !== "/admin") login.searchParams.set("next", `${pathname}${search}`);
      return withAdminHeaders(NextResponse.redirect(login));
    }
  }
  // Signed-in visitors of /admin/login are sent on by the login page itself,
  // after verifying the session (a stale cookie must not cause a loop).
  return withAdminHeaders(response);
}

function withAdminHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
