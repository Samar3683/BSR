import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE_OPTIONS, getSupabaseEnv } from "./env";

/** Admin pages reachable without a session. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/auth/confirm"];

function isPublicAdminPath(pathname: string) {
  return PUBLIC_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Only same-site admin paths are accepted as a post-login destination. */
export function safeAdminNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/admin") || value.startsWith("//") || value.includes("\\"))
    return "/admin";
  return value;
}

/**
 * Runs before every /admin request (navigations and link prefetches):
 * refreshes the Supabase session when it has expired (writing rotated tokens
 * to the response cookies) and redirects visitors without a session to the
 * login page.
 *
 * This is an optimistic check, read from the session cookie without a round
 * trip to the Auth server (which would add its latency to every click). The
 * panel layout verifies the user with the Auth server and the administrator
 * profile on each page load, and RLS enforces access on every query.
 */
export async function updateAdminSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const env = getSupabaseEnv();
  if (!env) return withAdminHeaders(response);

  const supabase = createServerClient(env.url, env.anonKey, {
    cookieOptions: { ...ADMIN_COOKIE_OPTIONS, secure: request.nextUrl.protocol === "https:" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getSession() refreshes an expired access token itself; otherwise it only
  // reads the cookie. Only presence and expiry matter here.
  const { data } = await supabase.auth.getSession();
  const expiresAt = (data.session?.expires_at ?? 0) * 1000;
  const signedIn = Boolean(data.session?.access_token) && expiresAt > Date.now();
  const { pathname, search } = request.nextUrl;

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return withAdminHeaders(redirect);
  };

  if (!signedIn && !isPublicAdminPath(pathname)) {
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(login);
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
