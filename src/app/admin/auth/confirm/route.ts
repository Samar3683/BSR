import { NextResponse, type NextRequest } from "next/server";

import { safeAdminNext } from "@/admin/lib/paths";
import { consumeToken } from "@/admin/server/auth";
import { isBackendConfigured } from "@/server/config";
import { setSessionCookie } from "@/admin/server/http";

const KINDS = ["recovery", "invite"] as const;

/**
 * Landing point of the emailed links (password recovery, administrator
 * invitations). The one-time token is consumed, a short session that may only
 * set a password is opened in the cookie, and the visitor continues to a
 * same-site admin page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeAdminNext(searchParams.get("next"));
  const token = searchParams.get("token_hash");
  const kind = searchParams.get("type");

  if (isBackendConfigured() && token && (KINDS as readonly string[]).includes(kind ?? "")) {
    const session = await consumeToken(
      token,
      kind as (typeof KINDS)[number],
      request.headers.get("user-agent"),
    );
    if (session) {
      const response = NextResponse.redirect(new URL(next, request.url));
      setSessionCookie(response, session, request);
      return response;
    }
  }
  return NextResponse.redirect(new URL("/admin/login?error=link", request.url));
}
