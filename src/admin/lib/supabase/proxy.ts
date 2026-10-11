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
 * Runs before every /admin request: refreshes the Supabase session (writing
 * rotated tokens to the response cookies) and redirects signed-out visitors
 * to the login page. This is an optimistic check; the panel layout verifies
 * the administrator profile and RLS enforces access on every query.
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

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
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
  if (signedIn && pathname === "/admin/login") {
    return redirectTo(
      new URL(safeAdminNext(request.nextUrl.searchParams.get("next")), request.url),
    );
  }
  return withAdminHeaders(response);
}

function withAdminHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
